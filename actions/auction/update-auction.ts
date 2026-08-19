"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { updateAuctionSchema } from "@/lib/validation/auction";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Edits timing/pricing for an UPCOMING auction that has zero bids. Once
 * either condition no longer holds — it started, or someone bid — the
 * brief's "do not allow invalid auction modifications after bidding has
 * progressed" applies: a bidder who placed 5100 against a 5000 starting
 * price is relying on those terms, and silently changing them out from
 * under an in-progress auction isn't a business rule any diagram defines.
 *
 * Phase 12 fix: authorization widened from admin-only to
 * owner-or-admin — a BUYER_SELLER can now create their own auctions
 * (create-auction.ts), so they need to be able to edit them too, while
 * ADMIN retains its existing override for any auction. The auction has to
 * be fetched before this check (unlike the plain `requireRole("ADMIN")`
 * this replaces) since ownership can only be evaluated against the actual
 * row's `createdById`.
 *
 * Phase 12 follow-up (now built): both the admin edit page
 * (app/(admin)/admin/auctions/[id]/edit) and the BUYER_SELLER self-service
 * edit page (app/(seller)/seller/auctions/[id]/edit) submit to this same
 * action via the same AuctionEditForm — the redirect below has to branch
 * on role so an owner lands back on their own list rather than bouncing
 * into /admin/auctions, which their role can't even enter.
 */
export async function updateAuctionAction(
  auctionId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Authenticate first, before touching the database at all — checking
  // existence/ownership before authentication would let an anonymous
  // request learn whether an auction ID exists.
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
  // Admins editing another user's auction still land on the admin list —
  // only fall back to the owner's own list when they're not an admin.
  const redirectTarget = isAdmin ? "/admin/auctions" : "/seller/auctions";

  // PENDING (awaiting admin approval) is still editable — a seller can
  // refine the terms of a not-yet-approved submission — along with the
  // existing UPCOMING window. Everything else (started/live/ended/
  // cancelled) is locked once it has bids or has started.
  if ((auction.status !== "UPCOMING" && auction.status !== "PENDING") || auction._count.bids > 0) {
    return { success: false, error: "This auction can no longer be edited — bidding may have started." };
  }

  const parsed = updateAuctionSchema.safeParse({
    startingPrice: formData.get("startingPrice"),
    minIncrement: formData.get("minIncrement"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { startingPrice, minIncrement, startTime, endTime } = parsed.data;
  const end = new Date(endTime);
  if (end.getTime() <= Date.now()) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { endTime: ["End time must be in the future."] },
    };
  }

  try {
    await prisma.$transaction([
      prisma.auction.update({
        where: { id: auctionId },
        data: { startingPrice, minIncrement, startTime: new Date(startTime), endTime: end },
      }),
      // Keep the display price on the Product row (used by ProductCard /
      // the catalog grid) in sync with the auction's starting price —
      // same reason create-auction.ts sets it at creation time.
      prisma.product.update({ where: { id: auction.productId }, data: { price: startingPrice } }),
    ]);
  } catch {
    return { success: false, error: "Could not update the auction. Please try again." };
  }

  revalidatePath("/admin/auctions");
  revalidatePath(`/admin/auctions/${auctionId}/edit`);
  revalidatePath("/seller/auctions");
  revalidatePath(`/seller/auctions/${auctionId}/edit`);
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
  redirect(redirectTarget);
}
