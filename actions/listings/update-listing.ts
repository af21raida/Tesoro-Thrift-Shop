"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { listingSchema } from "@/lib/validation/listing";
import {
  InvalidImageError,
  combineImages,
  saveUploadedImages,
  sanitizeExistingImagePaths,
} from "@/lib/uploads/save-images";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Edits a listing's product details. Two rules enforced server-side,
 * neither of which the edit form can be trusted to have respected:
 *
 * 1. Ownership — the caller must be the listing's own seller. This is a
 *    manual `session.userId === listing.sellerId` check rather than
 *    `requireOwnerOrRole(..., "ADMIN")`, because admins moderate listings
 *    (approve/reject/remove — see moderate-listing.ts) but never edit their
 *    content; letting an admin silently rewrite a seller's submission isn't
 *    a capability any diagram grants them.
 * 2. Status — PENDING, REJECTED, APPROVED, and ACTIVE listings can be
 *    edited by their owner. Editing an already-approved listing resubmits
 *    it for review (status -> PENDING, review metadata cleared) rather than
 *    silently changing content that already cleared moderation, keeping the
 *    "no bait-and-switch of an approved listing" guarantee intact — the
 *    same resubmission path an edit to a REJECTED listing already took.
 *    SOLD and REMOVED listings are terminal and stay locked. Editing a
 *    REJECTED listing resubmits it (status -> PENDING, review metadata
 *    cleared) rather than requiring a brand-new listing, per the Phase 1
 *    analysis's resolution of the sequence diagram's missing resubmission
 *    path.
 */
export async function updateListingAction(
  listingId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return { success: false, error: "This listing no longer exists." };
  }
  if (listing.sellerId !== session.userId) {
    throw new ForbiddenError("You can only edit your own listings.");
  }
  if (
    listing.status !== "PENDING" &&
    listing.status !== "REJECTED" &&
    listing.status !== "APPROVED" &&
    listing.status !== "ACTIVE"
  ) {
    return {
      success: false,
      error: `This listing is already ${listing.status.toLowerCase()} and can no longer be edited. Remove it and create a new listing if you need to change it.`,
    };
  }

  const parsed = listingSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    condition: formData.get("condition"),
    categoryId: formData.get("categoryId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, description, price, condition, categoryId, quantity } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { categoryId: ["Selected category no longer exists."] },
    };
  }

  const existingImages = sanitizeExistingImagePaths(formData.getAll("existingImages"));
  const imageFiles = formData.getAll("imageFiles").filter((entry): entry is File => entry instanceof File);
  let images: string[];
  try {
    const uploaded = await saveUploadedImages(imageFiles);
    images = combineImages(existingImages, uploaded);
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return { success: false, error: error.message, fieldErrors: { images: [error.message] } };
    }
    throw error;
  }

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: listing.productId },
        data: { name, description, price, condition, categoryId, images },
      }),
      // Safe to set this directly (not through decrementStock()'s guarded
      // UPDATE) rather than as a relative delta: for PENDING/REJECTED there
      // is no public exposure yet, and an edit to an APPROVED/ACTIVE
      // listing immediately resubmits it to PENDING (below), taking it back
      // off the marketplace — so any stock value written here is the
      // authoritative starting quantity for the re-review, and any checkout
      // still in flight against the previous approval operates on a listing
      // that is being pulled for review. `upsert` rather than `update`
      // because a listing created before this Phase 12 change won't have an
      // Inventory row yet — this backfills one on first edit instead of
      // failing.
      prisma.inventory.upsert({
        where: { productId: listing.productId },
        create: { productId: listing.productId, stock: Number(quantity), lowStockThreshold: 1, available: true },
        update: { stock: Number(quantity) },
      }),
      // Editing a PENDING listing just saves the changes in place; editing
      // a REJECTED, APPROVED, or ACTIVE listing resubmits it for review
      // (back to PENDING, review metadata cleared) so admin re-approves it.
      prisma.listing.update({
        where: { id: listingId },
        data:
          listing.status === "PENDING"
            ? {}
            : { status: "PENDING", reviewedById: null, reviewedAt: null, rejectionReason: null },
      }),
    ]);
  } catch {
    return { success: false, error: "Could not save changes. Please try again." };
  }

  revalidatePath("/seller/listings");
  revalidatePath(`/products/${listing.productId}`);
  revalidatePath("/admin/listings");
  redirect("/seller/listings");
}
