"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { createAuctionSchema } from "@/lib/validation/auction";
import { InvalidImageError, saveUploadedImages } from "@/lib/uploads/save-images";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Creates the AUCTION_ITEM `Product` and its `Auction` row in one
 * transaction. `createdById` is always the caller — for a BUYER_SELLER it
 * means their own auction listing, and ownership is established here rather
 * than needing a separate assignment step.
 *
 * Phase 12 fix: previously admin-only, per the (pre-role-merge) Admin
 * use-case diagram's "auctions are store-run, not a seller listing"
 * framing. The new role model makes auction creation a MUST-HAVE for
 * BUYER_SELLER ("create auction listings ... set starting price ...").
 * ADMIN no longer creates auctions directly (the /admin/auctions "New
 * auction" entry point was removed — admin's role is approving/reviewing
 * BUYER_SELLER submissions), so this action is BUYER_SELLER-only and the
 * auction always starts PENDING for admin approval. See
 * update-auction.ts/cancel-auction.ts for the ownership-aware management
 * side.
 *
 * There's no separate "make this existing product auctionable" flow:
 * because `Auction.productId` is `@unique` (Phase 2), a freshly created
 * product can never already be "involved in an incompatible active
 * auction" or "already sold" — those brief requirements are satisfied
 * structurally by always minting a new product here rather than needing a
 * runtime check against one that might already have listings/orders/other
 * auctions attached.
 */
export async function createAuctionAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const parsed = createAuctionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    categoryId: formData.get("categoryId"),
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

  const { name, description, condition, categoryId, startingPrice, minIncrement, startTime, endTime } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { categoryId: ["Selected category no longer exists."] },
    };
  }

  const imageFiles = formData.getAll("imageFiles").filter((entry): entry is File => entry instanceof File);
  let images: string[];
  try {
    images = await saveUploadedImages(imageFiles);
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return { success: false, error: error.message, fieldErrors: { images: [error.message] } };
    }
    throw error;
  }

  // Never trust the client's clock for either bound — both are re-checked
  // here against the server's own Date.now(), the same source of truth
  // lib/auction/bidding.ts's now() guard uses at bid time. createAuctionSchema
  // already applies the same two checks with a small tolerance on startTime
  // (see its START_TIME_PAST_SKEW_MS comment); this is defense-in-depth in
  // case this action is ever called from somewhere that bypasses the schema.
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (start.getTime() <= Date.now() - 60_000) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { startTime: ["Start time must be in the future."] },
    };
  }
  if (end.getTime() <= Date.now()) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { endTime: ["End time must be in the future."] },
    };
  }

  let auctionId: string;
  try {
    const auction = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { name, description, price: startingPrice, condition, categoryId, images, type: "AUCTION_ITEM" },
      });
      return tx.auction.create({
        data: {
          productId: product.id,
          createdById: session.userId,
          startTime: start,
          endTime: end,
          startingPrice,
          minIncrement,
          // A BUYER_SELLER's auction must be approved by an admin before it
          // can enter the lifecycle, so it always starts PENDING (see
          // lib/auction/approval.ts for the only way out of PENDING).
          status: "PENDING",
        },
      });
    });
    auctionId = auction.id;
  } catch {
    return { success: false, error: "Could not create the auction. Please try again." };
  }

  revalidatePath("/admin/auctions");
  revalidatePath("/seller/auctions");
  revalidatePath("/auctions");
  // A BUYER_SELLER's own auction goes to the matching self-service edit
  // screen at /seller/auctions/[id]/edit (see that page and
  // update-auction.ts's Phase 12 follow-up note).
  redirect(`/seller/auctions/${auctionId}/edit`);
}
