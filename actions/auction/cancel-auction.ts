"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * UPCOMING or ACTIVE -> CANCELLED, allowed only while the auction has zero
 * bids. Once a real bid exists, cancelling would silently void a
 * commitment the bidder reasonably expects to be honored if they win —
 * same "no invalid modification after bidding has progressed" rule
 * update-auction.ts applies to editing terms, applied here to cancellation.
 *
 * Phase 12 fix: widened from admin-only to owner-or-admin, matching
 * update-auction.ts — a BUYER_SELLER can cancel their own not-yet-bid-on
 * auction; ADMIN can still cancel any auction.
 */
export async function cancelAuctionAction(auctionId: string): Promise<ActionResult> {
  const session = await requireUser();

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { _count: { select: { bids: true } } },
  });
  if (!auction) {
    return { success: false, error: "This auction no longer exists." };
  }
  const isOwner = session.userId === auction.createdById;
  const isAdmin = session.roles.includes("ADMIN");
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError();
  }

  if (auction.status === "ENDED" || auction.status === "CANCELLED") {
    return { success: false, error: `This auction is already ${auction.status.toLowerCase()}.` };
  }
  if (auction._count.bids > 0) {
    return { success: false, error: "This auction already has bids and can no longer be cancelled." };
  }

  await prisma.auction.update({
    where: { id: auctionId },
    data: { status: "CANCELLED", closedAt: new Date() },
  });

  revalidatePath("/admin/auctions");
  revalidatePath("/seller/auctions");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
  return { success: true };
}
