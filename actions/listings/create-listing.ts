"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { listingSchema } from "@/lib/validation/listing";
import { InvalidImageError, saveUploadedImages } from "@/lib/uploads/save-images";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Creates a seller-owned marketplace listing: a `Product` row (type
 * USER_LISTING) plus its 1:1 `Listing` row starting at PENDING, plus now
 * an `Inventory` row too.
 *
 * Phase 12 fix: this used to treat a listing as always exactly one item,
 * with "is it still available" tracked purely via `Listing.status`
 * flipping to SOLD on purchase (see checkout.ts's git history) — no
 * `Inventory` row at all. The new role model requires sellers to specify
 * a real quantity when listing ("STAFF or BUYER_SELLER creates a
 * product/listing, they must be able to specify quantity/stock"), and
 * explicitly forbids a second, competing stock system — so rather than
 * adding a `quantity` column to `Listing` and inventing new decrement
 * logic for it, this now gives USER_LISTING products the exact same
 * `Inventory` row and `decrementStock()` guard THRIFT_STOCK products
 * already use (see lib/inventory/stock.ts, and checkout.ts's now-unified
 * handling of both product types). `lowStockThreshold` defaults to 1
 * rather than exposing that as a seller-facing field — it's a
 * store-operations tuning knob (see stockUpdateSchema, admin/staff-only),
 * not something a casual seller listing one item needs to think about.
 */
export async function createListingAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

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

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { name, description, price, condition, categoryId, images, type: "USER_LISTING" },
      });
      await tx.inventory.create({
        data: { productId: product.id, stock: Number(quantity), lowStockThreshold: 1, available: true },
      });
      await tx.listing.create({
        data: { productId: product.id, sellerId: session.userId, status: "PENDING" },
      });
    });
  } catch {
    return { success: false, error: "Could not create the listing. Please try again." };
  }

  revalidatePath("/seller/listings");
  revalidatePath("/seller");
  revalidatePath("/admin/listings");
  redirect("/seller/listings");
}
