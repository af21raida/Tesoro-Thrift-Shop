"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { stockUpdateSchema } from "@/lib/validation/product";
import { isLowStock } from "@/lib/inventory/stock";
import { notifyRole } from "@/lib/notifications/notify";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * The Staff-facing counterpart to update-product.ts: sets stock count,
 * low-stock threshold, and availability, but can never touch name, price,
 * description, category, or images. Matches the Staff use-case diagram
 * ("Manage Store Inventory", "Update Product Availability", "Update Stock
 * After Purchase") — Admin can also call this (it's a strict subset of
 * what update-product.ts allows), so the same form/action is reused on
 * both the admin and staff inventory pages.
 */
export async function updateStockAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("ADMIN", "STAFF");

  const parsed = stockUpdateSchema.safeParse({
    productId: formData.get("productId"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    available: formData.get("available"),
  });

  if (!parsed.success) {
    return { success: false, error: "Please fix the errors below." };
  }

  const { productId, stock, lowStockThreshold, available } = parsed.data;

  const inventory = await prisma.inventory.findUnique({
    where: { productId },
    include: { product: { select: { name: true } } },
  });
  if (!inventory) {
    return { success: false, error: "This product has no inventory record." };
  }

  const newStock = Number(stock);
  const newThreshold = Number(lowStockThreshold);
  // Compare before/after so this only fires the instant a correction
  // crosses into low-stock territory, not on every unrelated save while
  // it's already low — matches the Staff diagram's "Notify Admin" being
  // an <<extended>> branch of "Manage Store Inventory," not something
  // that fires on every inventory edit.
  const wasLow = isLowStock(inventory.stock, inventory.lowStockThreshold);
  const isNowLow = isLowStock(newStock, newThreshold);

  try {
    await prisma.inventory.update({
      where: { productId },
      data: { stock: newStock, lowStockThreshold: newThreshold, available: available === "on" },
    });
  } catch {
    return { success: false, error: "Could not update stock. Please try again." };
  }

  if (!wasLow && isNowLow) {
    await notifyRole("ADMIN", {
      type: "LOW_STOCK",
      message: `"${inventory.product.name}" is at or below its low-stock threshold (${newStock} left).`,
    });
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/staff/inventory");
  revalidatePath("/staff/products");
  return { success: true };
}
