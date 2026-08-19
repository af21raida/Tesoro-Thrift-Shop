import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placeBid, BidTooLowError } from "@/lib/auction/bidding";
import {
  hasDatabaseUrl,
  testPrisma,
  makeTestUser,
  makeTestCategory,
  makeTestAuctionProduct,
} from "@/lib/test-support/db";

/**
 * Gated on a real DATABASE_URL — see lib/test-support/db.ts's docstring
 * for why these don't run against a mock. `describe.skipIf` rather than
 * an early `return` so `npm test` reports these as explicitly SKIPPED,
 * not silently absent, when no database is configured.
 */
describe.skipIf(!hasDatabaseUrl)("placeBid concurrency (Phase 11 audit issue #2)", () => {
  let categoryId: string;
  let bidderAId: string;
  let bidderBId: string;

  beforeAll(async () => {
    const category = await makeTestCategory();
    categoryId = category.id;
    bidderAId = (await makeTestUser("bidder-a")).id;
    bidderBId = (await makeTestUser("bidder-b")).id;
  });

  afterAll(async () => {
    // FK-safe order: Bid -> Auction -> Product -> Category. The auction
    // creator/winner users are left in place until the very end since
    // Auction.createdById/winnerId reference them.
    await testPrisma.bid.deleteMany({ where: { auction: { product: { categoryId } } } });
    await testPrisma.auction.deleteMany({ where: { product: { categoryId } } });
    await testPrisma.product.deleteMany({ where: { categoryId } });
    await testPrisma.category.delete({ where: { id: categoryId } });
    await testPrisma.user.deleteMany({ where: { id: { in: [bidderAId, bidderBId] } } });
    await testPrisma.$disconnect();
  });

  async function makeActiveAuction() {
    const product = await makeTestAuctionProduct(categoryId);
    return testPrisma.auction.create({
      data: {
        productId: product.id,
        createdById: bidderAId, // arbitrary — no "creator can't bid" rule at the bidding.ts layer itself
        status: "ACTIVE",
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        startingPrice: "100.00",
        minIncrement: "1.00",
      },
    });
  }

  it("rejects a bid equal to the current highest bid (must be strictly higher, no fixed increment)", async () => {
    const auction = await makeActiveAuction();
    await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "150.00" });

    await expect(
      placeBid({ auctionId: auction.id, userId: bidderBId, amount: "150.00" }),
    ).rejects.toBeInstanceOf(BidTooLowError);

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("150.00");
    expect(await testPrisma.bid.count({ where: { auctionId: auction.id } })).toBe(1);
  });

  it("accepts a bid a single cent above the current highest bid — no minimum increment required", async () => {
    const auction = await makeActiveAuction();
    await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "150.00" });

    const secondBid = await placeBid({ auctionId: auction.id, userId: bidderBId, amount: "150.01" });
    expect(secondBid.amount.toFixed(2)).toBe("150.01");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("150.01");
    expect(await testPrisma.bid.count({ where: { auctionId: auction.id } })).toBe(2);
  });

  it("accepts any amount above the current highest bid, however large the jump", async () => {
    const auction = await makeActiveAuction();
    await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "150.00" });

    const secondBid = await placeBid({ auctionId: auction.id, userId: bidderBId, amount: "10000.00" });
    expect(secondBid.amount.toFixed(2)).toBe("10000.00");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("10000.00");
  });

  it("rejects a first bid below the starting price", async () => {
    const auction = await makeActiveAuction(); // startingPrice "100.00"

    await expect(
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "99.99" }),
    ).rejects.toBeInstanceOf(BidTooLowError);

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid).toBeNull();
    expect(await testPrisma.bid.count({ where: { auctionId: auction.id } })).toBe(0);
  });

  it("accepts a first bid exactly equal to the starting price — the floor may be met, not cleared", async () => {
    const auction = await makeActiveAuction(); // startingPrice "100.00"

    const firstBid = await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "100.00" });
    expect(firstBid.amount.toFixed(2)).toBe("100.00");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("100.00");
    expect(await testPrisma.bid.count({ where: { auctionId: auction.id } })).toBe(1);
  });

  it("accepts a first bid a single cent above the starting price", async () => {
    const auction = await makeActiveAuction(); // startingPrice "100.00"

    await expect(
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "100.01" }),
    ).resolves.toBeTruthy();

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("100.01");
  });

  it("rejects a bid lower than the current highest bid", async () => {
    const auction = await makeActiveAuction();
    await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "200.00" });

    await expect(
      placeBid({ auctionId: auction.id, userId: bidderBId, amount: "180.00" }),
    ).rejects.toBeInstanceOf(BidTooLowError);

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("200.00");
  });

  /**
   * THE CORE CONCURRENCY TEST (audit issue #2, item 1): two bidders submit
   * the *same* amount at effectively the same moment. Since a bid must be
   * STRICTLY higher than the current highest bid (no fixed increment, but
   * still no ties), an equal bid is never valid against an
   * already-committed identical bid: under the guarded UPDATE...WHERE,
   * whichever commits first raises `currentHighestBid` to 150, and the
   * second's WHERE clause (`amount > currentHighestBid`) then correctly
   * fails to match against that already-committed 150 — so exactly one of
   * the two is accepted, never both, and never neither. This proves the
   * guard isn't comparing against a *stale* read of the highest bid.
   */
  it("under real concurrency, only one of two identical simultaneous bids is accepted", async () => {
    const auction = await makeActiveAuction();

    const [resultA, resultB] = await Promise.allSettled([
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "150.00" }),
      placeBid({ auctionId: auction.id, userId: bidderBId, amount: "150.00" }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(BidTooLowError);
    }

    // The database, not application logic, is the source of truth: only
    // one Bid row exists, and Auction.currentHighestBid agrees with it.
    const bids = await testPrisma.bid.findMany({ where: { auctionId: auction.id } });
    expect(bids).toHaveLength(1);
    expect(bids[0]?.amount.toFixed(2)).toBe("150.00");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("150.00");
  });

  /**
   * A second concurrency shape: two *different* amounts arriving at once,
   * where the lower one only clears the starting price, not the higher
   * one's amount. Whichever of the two the database happens to apply
   * first, the final state must never let the lower bid "win" over an
   * already-committed higher one.
   */
  it("under real concurrency, a lower bid can never overwrite an already-committed higher bid", async () => {
    const auction = await makeActiveAuction();

    const results = await Promise.allSettled([
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "500.00" }),
      placeBid({ auctionId: auction.id, userId: bidderBId, amount: "105.00" }),
    ]);

    // Both may succeed (if the lower bid commits first, 500 still clears
    // 105) or only one may (if 500 commits first, 105 no longer clears
    // 500) — either is correct. What must never happen is the final
    // highest bid being anything other than 500, or more than 2 Bid rows
    // existing (no duplicate accepts).
    const bids = await testPrisma.bid.findMany({
      where: { auctionId: auction.id },
      orderBy: { amount: "asc" },
    });
    expect(bids.length).toBeGreaterThanOrEqual(1);
    expect(bids.length).toBeLessThanOrEqual(2);
    expect(bids[bids.length - 1]?.amount.toFixed(2)).toBe("500.00");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("500.00");
    void results; // outcomes intentionally not asserted individually — see comment above
  });
});
