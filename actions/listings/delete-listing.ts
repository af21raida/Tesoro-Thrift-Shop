"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Deletes the listing's underlying `Product`, which cascades to the
 * `Listing` row automatically (`Listing.product onDelete: Cascade`) — same
 * pattern as delete-product.ts. A SOLD listing is refused outright rather
 * than attempting the delete: it's guaranteed to have an `OrderItem`
 * referencing it (no cascade there, by design — order history must stay
 * intact), so the delete would fail anyway; refusing early gives a clearer
 * message than surfacing the FK violation.
 */
export async function deleteListingAction(listingId: string): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return { success: false, error: "This listing no longer exists." };
  }
  if (listing.sellerId !== session.userId) {
    throw new ForbiddenError("You can only delete your own listings.");
  }
  if (listing.status === "SOLD") {
    return {
      success: false,
      error: "This listing has already sold and is part of order history — it can't be deleted.",
    };
  }

  try {
    await prisma.product.delete({ where: { id: listing.productId } });
  } catch {
    return {
      success: false,
      error: "This listing can't be deleted — it's referenced by an existing order.",
    };
  }

  revalidatePath("/seller/listings");
  revalidatePath("/seller");
  revalidatePath("/admin/listings");
  revalidatePath("/products");
  return { success: true };
}
