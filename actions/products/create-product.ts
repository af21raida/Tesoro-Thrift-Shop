"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { productSchema } from "@/lib/validation/product";
import { InvalidImageError, saveUploadedImages } from "@/lib/uploads/save-images";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Creates a store-owned (THRIFT_STOCK) product. Allowed for ADMIN and
 * STAFF: staff run the day-to-day thrift-shop floor (receiving new
 * donated/purchased stock, listing it for sale), so "add a store-owned
 * product" is a STAFF capability too, not just an ADMIN one — enforced
 * here via `requireRole("ADMIN", "STAFF")` rather than swapping ADMIN for
 * STAFF, so neither role loses access. Seller-submitted marketplace
 * products go through the separate, moderated `Listing` flow in Phase 6
 * (actions/listings), and auction products get their `Auction` row in
 * Phase 8 — this action only ever creates `type: THRIFT_STOCK`, reusing
 * the exact same Product + Inventory write path regardless of which of
 * the two allowed roles is calling it.
 */
export async function createProductAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("ADMIN", "STAFF");

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    condition: formData.get("condition"),
    categoryId: formData.get("categoryId"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    available: formData.get("available"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, description, price, condition, categoryId, stock, lowStockThreshold, available } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: { categoryId: ["Selected category no longer exists."] },
    };
  }

  // Images are uploaded files, not pasted URLs — see lib/uploads/save-images.ts.
  // Validated (type via magic bytes, size, count) and written to
  // public/uploads/ here; only the resulting server-generated paths are
  // ever stored on the Product.
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

  let productId: string;
  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          description,
          price,
          condition,
          categoryId,
          images,
          type: "THRIFT_STOCK",
        },
      });
      await tx.inventory.create({
        data: {
          productId: created.id,
          stock: Number(stock),
          lowStockThreshold: Number(lowStockThreshold),
          available: available === "on",
        },
      });
      return created;
    });
    productId = product.id;
  } catch {
    return { success: false, error: "Could not create the product. Please try again." };
  }

  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/staff/products");
  revalidatePath("/staff/inventory");
  redirect(`/products/${productId}`);
}
