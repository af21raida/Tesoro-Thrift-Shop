"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { productSchema } from "@/lib/validation/product";
import {
  InvalidImageError,
  combineImages,
  saveUploadedImages,
  sanitizeExistingImagePaths,
} from "@/lib/uploads/save-images";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Edits catalog metadata AND the inventory row together, so a single admin
 * form can cover both — but this stays Admin-only (see create-product.ts
 * for why). Staff-facing stock/availability edits go through
 * update-stock.ts instead, which is deliberately narrower.
 */
export async function updateProductAction(
  productId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return { success: false, error: "This product no longer exists." };
  }
  if (existing.type !== "THRIFT_STOCK") {
    // Listings and auction items are edited through their own Phase 6/8
    // flows (a seller editing their listing, an admin editing an auction
    // before it starts) — this form only ever touches store stock.
    return {
      success: false,
      error: "This product is managed through the listings/auction flow, not here.",
    };
  }

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

  // `existingImages` are previously-saved paths the form echoed back
  // (edit form's "keep this one" state) — sanitized against our own
  // /uploads/... allowlist rather than trusted verbatim. `imageFiles`
  // are freshly-selected files, validated and saved the same way
  // create-product.ts does.
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
        where: { id: productId },
        data: { name, description, price, condition, categoryId, images },
      }),
      prisma.inventory.upsert({
        where: { productId },
        create: {
          productId,
          stock: Number(stock),
          lowStockThreshold: Number(lowStockThreshold),
          available: available === "on",
        },
        update: {
          stock: Number(stock),
          lowStockThreshold: Number(lowStockThreshold),
          available: available === "on",
        },
      }),
    ]);
  } catch {
    return { success: false, error: "Could not save changes. Please try again." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  redirect(`/products/${productId}`);
}
