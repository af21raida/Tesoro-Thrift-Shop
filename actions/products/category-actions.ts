"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { categorySchema, slugify } from "@/lib/validation/category";
import type { ActionResult } from "@/lib/validation/action-result";

/** Appends -2, -3, ... to a slug until it's free. Collisions are rare at this scale. */
async function uniqueSlug(base: string): Promise<string> {
  const slug = base || "category";
  let candidate = slug;
  let suffix = 2;
  while (await prisma.category.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createCategoryAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, description } = parsed.data;

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    return {
      success: false,
      error: "A category with that name already exists.",
      fieldErrors: { name: ["A category with that name already exists."] },
    };
  }

  const slug = await uniqueSlug(slugify(name));

  try {
    await prisma.category.create({ data: { name, slug, description: description || null } });
  } catch {
    return { success: false, error: "Could not create the category. Please try again." };
  }

  revalidatePath("/categories");
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, description } = parsed.data;

  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: { name, description: description || null },
    });
  } catch {
    return { success: false, error: "Could not save changes. That name may already be taken." };
  }

  revalidatePath("/categories");
  revalidatePath("/admin/categories");
  return { success: true };
}

/**
 * Deleting a category with products in it would either orphan them or
 * cascade-delete an entire aisle of the store by accident, so this refuses
 * outright rather than guessing which behavior the admin wanted. The admin
 * has to reassign or remove the products first.
 *
 * Two layers, same "count check for a friendly message, DB constraint as
 * the real guarantee" pattern this codebase already uses for stock and
 * bidding (see lib/inventory/stock.ts, lib/auction/closing.ts):
 * 1. The `productCount` check below gives a specific, friendly error
 *    ("N products still use this category") in the common case.
 * 2. Phase 11 fix (audit issue #6): that check and the delete aren't
 *    atomic with each other, so a product could theoretically be created
 *    in this category in between. `Product.category` now has an explicit
 *    `onDelete: Restrict` (prisma/schema.prisma), so PostgreSQL itself
 *    refuses the delete in that case with a foreign-key violation (Prisma
 *    error P2003) rather than orphaning `Product.categoryId` — caught
 *    below and turned into the same kind of friendly message instead of
 *    a raw error.
 */
export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const productCount = await prisma.product.count({ where: { categoryId } });
  if (productCount > 0) {
    return {
      success: false,
      error: `Can't delete — ${productCount} product(s) still use this category. Move or delete them first.`,
    };
  }

  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        success: false,
        error: "Can't delete — a product was added to this category just now. Move or delete it first.",
      };
    }
    return { success: false, error: "Could not delete the category. Please try again." };
  }

  revalidatePath("/categories");
  revalidatePath("/admin/categories");
  return { success: true };
}
