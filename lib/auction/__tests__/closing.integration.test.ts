import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { finalizeAuction } from "@/lib/auction/closing";
import { placeBid } from "@/lib/auction/bidding";
import {
  hasDatabaseUrl,
  testPrisma,
  makeTestUser,
  makeTestCategory,
  makeTestAuctionProduct,
} from "@/lib/test-support/db";

describe.skipIf(!hasDatabaseUrl)("finalizeAuction idempotency (Phase 11 audit issues #2/#4)", () => {
  let categoryId: string;
  let creatorId: string;
  let bidderId: string;

  beforeAll(async () => {
    categoryId = (await makeTestCategory()).id;
    creatorId = (await makeTestUser("creator")).id;
    bidderId = (await makeTestUser("winner")).id;
  });

  afterAll(async () => {
    // FK-safe order: Transaction -> Order, then Bid -> Auction -> Product
    // -> Category, then the users. Order.auctionId is an optional relation
    // (SetNull on delete) so Auction can be removed independently; Order
    // itself cascade-deletes OrderItem.
    const orders = await testPrisma.order.findMany({
      where: { items: { some: { product: { categoryId } } } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await testPrisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await testPrisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await testPrisma.bid.deleteMany({ where: { auction: { product: { categoryId } } } });
    await testPrisma.auction.deleteMany({ where: { product: { categoryId } } });
    await testPrisma.product.deleteMany({ where: { categoryId } });
    await testPrisma.category.delete({ where: { id: categoryId } });
    await testPrisma.user.deleteMany({ where: { id: { in: [creatorId, bidderId] } } });
    await testPrisma.$disconnect();
  });

  async function makeOverdueAuctionWithBid() {
    const product = await makeTestAuctionProduct(categoryId);
    const auction = await testPrisma.auction.create({
      data: {
        productId: product.id,
        createdById: creatorId,
        status: "ACTIVE",
        // Started an hour ago, ended a second ago — i.e. exactly the state
        // closeExpiredAuctions()/ensureAuctionFinalized() find "due".
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1000),
        startingPrice: "100.00",
        minIncrement: "1.00",
      },
    });
    // placeBid() itself requires now() < endTime, so seed the winning bid
    // directly rather than through placeBid() for an auction that's
    // already (deliberately) past its end time.
    await testPrisma.bid.create({
      data: { auctionId: auction.id, userId: bidderId, amount: "250.00" },
    });
    await testPrisma.auction.update({
      where: { id: auction.id },
      data: { currentHighestBid: "250.00" },
    });
    return auction;
  }

  /**
   * THE REGRESSION TEST audit issue #4 asks for: finalizeAuction() called
   * twice concurrently for the same overdue auction must produce exactly
   * one Order, one Transaction, and one recorded winner — never two. This
   * is the test that would fail if the SELECT ... FOR UPDATE row lock in
   * lib/auction/closing.ts were ever weakened or removed, and it also
   * exercises the Order.auctionId @unique / P2002 backstop (the second
   * layer that file's docstring describes) by construction: if the row
   * lock somehow didn't serialize the two calls, the unique constraint is
   * what would catch it instead.
   */
  it("two concurrent finalizeAuction() calls produce exactly one Order/Transaction/winner", async () => {
    const auction = await makeOverdueAuctionWithBid();

    const [resultA, resultB] = await Promise.all([
      finalizeAuction(auction.id),
      finalizeAuction(auction.id),
    ]);

    const outcomes = [resultA.outcome, resultB.outcome].sort();
    // Exactly one call does the real work; the other finds it already done.
    expect(outcomes).toEqual(["ALREADY_FINALIZED", "WINNER_RECORDED"]);

    const winnerRecordedResult = resultA.outcome === "WINNER_RECORDED" ? resultA : resultB;
    expect(winnerRecordedResult.winnerId).toBe(bidderId);
    expect(winnerRecordedResult.orderId).toBeDefined();

    const orders = await testPrisma.order.findMany({ where: { auctionId: auction.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.userId).toBe(bidderId);
    expect(orders[0]?.totalAmount.toFixed(2)).toBe("250.00");

    const transactions = await testPrisma.transaction.findMany({
      where: { orderId: orders[0]?.id },
    });
    expect(transactions).toHaveLength(1);

    const finalAuction = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(finalAuction.status).toBe("ENDED");
    expect(finalAuction.winnerId).toBe(bidderId);
  });

  it("finalizeAuction() called a third time (sequentially, after both concurrent calls) stays a no-op", async () => {
    const auction = await makeOverdueAuctionWithBid();

    await Promise.all([finalizeAuction(auction.id), finalizeAuction(auction.id)]);
    const third = await finalizeAuction(auction.id);

    expect(third.outcome).toBe("ALREADY_FINALIZED");
    const orders = await testPrisma.order.findMany({ where: { auctionId: auction.id } });
    expect(orders).toHaveLength(1);
  });

  it("an auction with no bids ends with no winner and no order (not an idempotency bug — a valid outcome)", async () => {
    const product = await makeTestAuctionProduct(categoryId);
    const auction = await testPrisma.auction.create({
      data: {
        productId: product.id,
        createdById: creatorId,
        status: "ACTIVE",
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1000),
        startingPrice: "100.00",
        minIncrement: "1.00",
      },
    });

    const result = await finalizeAuction(auction.id);
    expect(result.outcome).toBe("NO_BIDS");

    const finalAuction = await testPrisma.auction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(finalAuction.status).toBe("ENDED");
    expect(finalAuction.winnerId).toBeNull();
    expect(await testPrisma.order.count({ where: { auctionId: auction.id } })).toBe(0);
  });

  // Not exercised via concurrency here (placeBid()'s own guard requires an
  // ACTIVE, not-yet-ended auction — see
  // lib/auction/__tests__/bidding.integration.test.ts for placeBid()'s own
  // concurrency coverage), but included for completeness against audit
  // issue #1's expected lifecycle: a bid must never succeed once
  // finalizeAuction() has already run.
  it("a bid attempted after finalization is rejected (status is no longer ACTIVE)", async () => {
    const auction = await makeOverdueAuctionWithBid();
    await finalizeAuction(auction.id);

    await expect(
      placeBid({ auctionId: auction.id, userId: creatorId, amount: "999.00" }),
    ).rejects.toThrow();
  });
});
