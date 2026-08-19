import "server-only";
import { prisma } from "@/lib/db/prisma";
import { AuctionNotFoundError } from "@/lib/auction/bidding";

export class AuctionNotPendingError extends Error {
  constructor() {
    super("This auction is not awaiting approval.");
    this.name = "AuctionNotPendingError";
  }
}

/**
 * PENDING -> UPCOMING, the only transition that lets a Buyer_Seller-created
 * auction enter the normal UPCOMING -> ACTIVE -> ENDED lifecycle. Uses the
 * same "guard lives in the WHERE clause" pattern as lib/auction/bidding.ts
 * and lib/auction/closing.ts: a single guarded UPDATE can't double-approve
 * or race, and an Admin-created (UPCOMING) or already-started auction is
 * never touched — admin approval only ever acts on PENDING rows.
 *
 * The server action (actions/auction/approve-auction.ts) is the
 * ADMIN-gated thin wrapper around this, matching how placeBid / finalizeAuction
 * sit behind their own actions. After approval the existing lifecycle code
 * (activateDueAuctions/ensureAuctionActivated, placeBid, finalizeAuction)
 * needs no awareness of PENDING — none of them match it, which is exactly
 * what keeps a pending auction un-biddable and un-finalizable.
 */
export async function approveAuction(auctionId: string): Promise<void> {
  const affected = await prisma.auction.updateMany({
    where: { id: auctionId, status: "PENDING" },
    data: { status: "UPCOMING" },
  });

  if (affected.count === 0) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new AuctionNotFoundError();
    throw new AuctionNotPendingError();
  }
}