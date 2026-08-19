"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Deletes a THRIFT_STOCK product. `Inventory` cascades automatically
 * (`onDelete: Cascade` in the schema). `OrderItem.product` has no cascade,
 * so a product that's already part of a placed order will fail this
 * delete with a foreign-key violation — that's intentional (order history
 * must stay intact) and surfaces here as a friendly error instead of a
 * 500.
 */
export async function deleteProductAction(productId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return { success: false, error: "This product no longer exists." };
  }
  if (existing.type !== "THRIFT_STOCK") {
    return {
      success: false,
      error: "This product is managed through the listings/auction flow, not here.",
    };
  }

  try {
    await prisma.product.delete({ where: { id: productId } });
  } catch {
    return {
      success: false,
      error: "This product can't be deleted — it's referenced by an existing order. Mark it unavailable instead.",
    };
  }

  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return { success: true };
}
