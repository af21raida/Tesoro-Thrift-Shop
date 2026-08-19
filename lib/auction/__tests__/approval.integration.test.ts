import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placeBid, AuctionNotStartedError } from "@/lib/auction/bidding";
import { approveAuction } from "@/lib/auction/approval";
import { ensureAuctionActivated } from "@/lib/auction/closing";
import {
  hasDatabaseUrl,
  testPrisma,
  makeTestUser,
  makeTestCategory,
  makeTestAuctionProduct,
} from "@/lib/test-support/db";

/**
 * Gated on a real DATABASE_URL, same as bidding/closing integration tests.
 * Covers the Buyer_Seller auction approval flow: create-auction.ts writes
 * PENDING for a non-ADMIN creator, a PENDING auction is not biddable,
 * approveAuction (the lib behind the ADMIN approve action) flips it to
 * UPCOMING, and only then does the existing UPCOMING -> ACTIVE -> ENDED
 * lifecycle take over. Also pins that Admin-created auctions are untouched
 * (still UPCOMING at creation and immediately biddable once started).
 */
describe.skipIf(!hasDatabaseUrl)("Buyer_Seller auction approval (approval flow)", () => {
  let categoryId: string;
  let sellerId: string;
  let bidderAId: string;
  let bidderBId: string;

  beforeAll(async () => {
    const category = await makeTestCategory();
    categoryId = category.id;
    sellerId = (await makeTestUser("seller")).id;
    bidderAId = (await makeTestUser("bidder-a")).id;
    bidderBId = (await makeTestUser("bidder-b")).id;
  });

  afterAll(async () => {
    await testPrisma.bid.deleteMany({ where: { auction: { product: { categoryId } } } });
    await testPrisma.auction.deleteMany({ where: { product: { categoryId } } });
    await testPrisma.product.deleteMany({ where: { categoryId } });
    await testPrisma.category.delete({ where: { id: categoryId } });
    await testPrisma.user.deleteMany({ where: { id: { in: [sellerId, bidderAId, bidderBId] } } });
    await testPrisma.$disconnect();
  });

  async function makeAuction(overrides: { status: "PENDING" | "UPCOMING" }) {
    const product = await makeTestAuctionProduct(categoryId);
    return testPrisma.auction.create({
      data: {
        productId: product.id,
        createdById: sellerId,
        status: overrides.status,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        startingPrice: "30.00",
        minIncrement: "1.00",
      },
    });
  }

  it("a Buyer_Seller-created auction starts PENDING, rejects bids until approved, then follows the lifecycle", async () => {
    const auction = await makeAuction({ status: "PENDING" });

    // Buyers can't bid on a pending auction — it isn't ACTIVE, and the
    // diagnostic reports it as not-yet-started rather than bid-too-low.
    await expect(
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "31.00" }),
    ).rejects.toBeInstanceOf(AuctionNotStartedError);

    // Admin approval: PENDING -> UPCOMING.
    await approveAuction(auction.id);
    let updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.status).toBe("UPCOMING");

    // Still not biddable until the existing UPCOMING -> ACTIVE transition.
    await expect(
      placeBid({ auctionId: auction.id, userId: bidderAId, amount: "31.00" }),
    ).rejects.toBeInstanceOf(AuctionNotStartedError);

    // Same lazy-activation path the app uses on page view.
    await ensureAuctionActivated({
      id: auction.id,
      status: updated.status,
      startTime: updated.startTime,
      endTime: updated.endTime,
    });
    updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.status).toBe("ACTIVE");

    // A Buyer_Seller can bid once the approved auction is live.
    const firstBid = await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "30.00" });
    expect(firstBid.amount.toFixed(2)).toBe("30.00");

    const secondBid = await placeBid({ auctionId: auction.id, userId: bidderBId, amount: "31.00" });
    expect(secondBid.amount.toFixed(2)).toBe("31.00");

    updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.currentHighestBid?.toFixed(2)).toBe("31.00");
  });

  it("an Admin-created auction still starts UPCOMING and is biddable once live", async () => {
    const auction = await makeAuction({ status: "UPCOMING" });

    let updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.status).toBe("UPCOMING");

    await ensureAuctionActivated({
      id: auction.id,
      status: updated.status,
      startTime: updated.startTime,
      endTime: updated.endTime,
    });
    updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.status).toBe("ACTIVE");

    const bid = await placeBid({ auctionId: auction.id, userId: bidderAId, amount: "30.00" });
    expect(bid.amount.toFixed(2)).toBe("30.00");
  });

  it("approving an auction that is not PENDING is a no-op error", async () => {
    const auction = await makeAuction({ status: "UPCOMING" });

    await expect(approveAuction(auction.id)).rejects.toThrow("not awaiting approval");

    const updated = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(updated.status).toBe("UPCOMING");
  });
});
