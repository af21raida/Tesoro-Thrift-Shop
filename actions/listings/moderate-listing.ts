"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { rejectListingSchema } from "@/lib/validation/listing";
import { notify } from "@/lib/notifications/notify";
import type { ActionResult } from "@/lib/validation/action-result";

function revalidateListingPaths(): void {
  revalidatePath("/admin/listings");
  revalidatePath("/seller/listings");
  revalidatePath("/products");
}

/**
 * PENDING -> APPROVED. Per the Phase 1 analysis's reading of the brief, no
 * diagram defines a separate "publish" use case beyond the admin's
 * approve/reject decision, so approval is the terminal "this listing is now
 * legitimate" state and the public catalog query (lib/listings/visibility.ts)
 * treats APPROVED the same as ACTIVE. ACTIVE itself is left for a later
 * phase to define a trigger for (e.g. something auction- or
 * checkout-adjacent) rather than inventing an unspecified transition here.
 */
export async function approveListingAction(listingId: string): Promise<ActionResult> {
  const session = await requireRole("ADMIN");

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return { success: false, error: "This listing no longer exists." };
  }
  if (listing.sellerId === session.userId) {
    // Belt-and-suspenders: nothing in the UI lets an admin end up owning a
    // listing today, but the brief is explicit that "sellers cannot
    // approve their own listings" — enforce it here too, not just by
    // omission.
    throw new ForbiddenError("You cannot approve your own listing.");
  }
  if (listing.status !== "PENDING") {
    return { success: false, error: `This listing is already ${listing.status.toLowerCase()}.` };
  }

  try {
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "APPROVED", reviewedById: session.userId, reviewedAt: new Date(), rejectionReason: null },
    });
  } catch {
    return { success: false, error: "Could not approve the listing. Please try again." };
  }

  await notify({
    userId: listing.sellerId,
    type: "LISTING_APPROVED",
    message: "Your listing was approved and is now live in the marketplace.",
  });

  revalidateListingPaths();
  return { success: true };
}

/** PENDING -> REJECTED, with a required reason the seller can act on when resubmitting. */
export async function rejectListingAction(
  listingId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("ADMIN");

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return { success: false, error: "This listing no longer exists." };
  }
  if (listing.sellerId === session.userId) {
    throw new ForbiddenError("You cannot review your own listing.");
  }
  if (listing.status !== "PENDING") {
    return { success: false, error: `This listing is already ${listing.status.toLowerCase()}.` };
  }

  const parsed = rejectListingSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        status: "REJECTED",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });
  } catch {
    return { success: false, error: "Could not reject the listing. Please try again." };
  }

  await notify({
    userId: listing.sellerId,
    type: "LISTING_REJECTED",
    message: `Your listing was rejected: ${parsed.data.reason}`,
  });

  revalidateListingPaths();
  return { success: true };
}

/**
 * Any non-REMOVED status -> REMOVED. Unlike approve/reject, this isn't
 * limited to PENDING — "remove inappropriate listings" (Admin use-case
 * diagram) has to be able to pull something already APPROVED/ACTIVE off
 * the marketplace too, not just reject it before it ever went live.
 */
export async function removeListingAction(listingId: string): Promise<ActionResult> {
  const session = await requireRole("ADMIN");

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return { success: false, error: "This listing no longer exists." };
  }
  if (listing.status === "REMOVED") {
    return { success: false, error: "This listing has already been removed." };
  }

  try {
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "REMOVED", reviewedById: session.userId, reviewedAt: new Date() },
    });
  } catch {
    return { success: false, error: "Could not remove the listing. Please try again." };
  }

  revalidateListingPaths();
  return { success: true };
}
