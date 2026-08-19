"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { placeBidSchema } from "@/lib/validation/auction";
import {
  placeBid,
  AuctionNotFoundError,
  AuctionNotStartedError,
  AuctionEndedError,
  AuctionCancelledError,
  BidTooLowError,
} from "@/lib/auction/bidding";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Phase 12 fix: gated on `requireRole("BUYER_SELLER")`, not `requireUser()`.
 * Previously "any authenticated user can bid" was correct because every
 * account had the BUYER role by default; now that ADMIN and STAFF are
 * distinct from BUYER_SELLER, the new role model explicitly requires that
 * neither can bid ("STAFF cannot participate in auctions as a bidder";
 * "ADMIN cannot place bids").
 *
 * Never trusts the client for auction status, price, or user identity —
 * `auctionId` and `amount` are the only inputs; everything else (who's
 * bidding, whether the auction is actually open, what the real current
 * highest bid is) comes from the session and the database inside
 * lib/auction/bidding.ts's atomic guard.
 */
export async function placeBidAction(auctionId: string, amount: string): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const parsed = placeBidSchema.safeParse({ auctionId, amount });
  if (!parsed.success) {
    return { success: false, error: "Enter a valid bid amount." };
  }

  try {
    await placeBid({ auctionId: parsed.data.auctionId, userId: session.userId, amount: parsed.data.amount });
  } catch (error) {
    if (error instanceof AuctionNotFoundError) return { success: false, error: error.message };
    if (error instanceof AuctionCancelledError) return { success: false, error: error.message };
    if (error instanceof AuctionEndedError) return { success: false, error: error.message };
    if (error instanceof AuctionNotStartedError) return { success: false, error: error.message };
    if (error instanceof BidTooLowError) return { success: false, error: error.message };
    return { success: false, error: "Could not place your bid. Please try again." };
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
  revalidatePath("/bids");
  return { success: true };
}
