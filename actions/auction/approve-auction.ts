"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { approveAuction, AuctionNotPendingError } from "@/lib/auction/approval";
import { AuctionNotFoundError } from "@/lib/auction/bidding";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * ADMIN-only PENDING -> UPCOMING approval for Buyer_Seller-created
 * auctions. Mirrors approveListingAction's shape (actions/listings/
 * moderate-listing.ts): the role gate and the friendly error mapping live
 * here, the actual guarded transition lives in lib/auction/approval.ts so
 * it's directly testable the same way placeBid/finalizeAuction are.
 */
export async function approveAuctionAction(auctionId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  try {
    await approveAuction(auctionId);
  } catch (error) {
    if (error instanceof AuctionNotFoundError) return { success: false, error: error.message };
    if (error instanceof AuctionNotPendingError) return { success: false, error: error.message };
    return { success: false, error: "Could not approve the auction. Please try again." };
  }

  revalidatePath("/admin/auctions");
  revalidatePath("/seller/auctions");
  revalidatePath("/auctions");
  return { success: true };
}