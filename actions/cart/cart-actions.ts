"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validation/cart";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Phase 12 fix: this used to call `requireUser()` on the reasoning that
 * "every registered user gets the BUYER role by default, so buying isn't a
 * permission some accounts lack." That reasoning no longer holds — ADMIN
 * and STAFF are now separate from the combined BUYER_SELLER role, and the
 * new role model explicitly requires that neither can buy (STAFF: "cannot
 * add products to cart"; ADMIN: "cannot buy"). `requireRole("BUYER_SELLER")`
 * is the real boundary now, not just `/cart`'s middleware.ts prefix (which
 * is narrowed to match, but — per the brief's own "don't rely on hiding
 * routes" instruction — is a UX convenience, not the enforcement point).
 */

/**
 * `USER_LISTING` products never get an `Inventory` row (create-listing.ts:
 * "a listing is always a single secondhand item, not a stocked SKU"), so
 * their "stock" is just whether the `Listing` is still in a purchasable
 * status (APPROVED or ACTIVE — see moderate-listing.ts's note that the
 * public catalog treats the two the same). Quantity is therefore always
 * exactly 1 and never user-editable — enforced here on add, and again in
 * updateCartItemQuantityAction so a client can't bypass the add-time check
 * by editing quantity afterward.
 */
function isPurchasableListingStatus(status: string): boolean {
  return status === "APPROVED" || status === "ACTIVE";
}

export async function addToCartAction(productId: string, quantity: number): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const parsed = addToCartSchema.safeParse({ productId, quantity });
  if (!parsed.success) {
    return { success: false, error: "Invalid quantity." };
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    include: { inventory: true, listing: true },
  });
  if (!product) {
    return { success: false, error: "This product no longer exists." };
  }

  let quantityToAdd = parsed.data.quantity;

  if (product.type === "AUCTION_ITEM") {
    return { success: false, error: "Auction items aren't added to a cart — place a bid instead." };
  }

  if (product.type === "USER_LISTING") {
    if (!product.listing || !isPurchasableListingStatus(product.listing.status)) {
      return { success: false, error: "This listing isn't available for purchase." };
    }
    if (product.listing.sellerId === session.userId) {
      return { success: false, error: "You can't buy your own listing." };
    }
    quantityToAdd = 1;
  }

  if (product.type === "THRIFT_STOCK") {
    if (!product.inventory || !product.inventory.available) {
      return { success: false, error: "This item isn't currently available." };
    }
    if (product.inventory.stock <= 0) {
      return { success: false, error: "This item is out of stock." };
    }
  }

  const cart = await prisma.cart.upsert({
    where: { userId: session.userId },
    update: {},
    create: { userId: session.userId },
  });

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  if (existing) {
    if (product.type === "USER_LISTING") {
      return { success: false, error: "This listing is already in your cart." };
    }
    const newQuantity = existing.quantity + quantityToAdd;
    if (product.inventory && newQuantity > product.inventory.stock) {
      return { success: false, error: `Only ${product.inventory.stock} left in stock.` };
    }
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQuantity } });
  } else {
    if (product.type === "THRIFT_STOCK" && product.inventory && quantityToAdd > product.inventory.stock) {
      return { success: false, error: `Only ${product.inventory.stock} left in stock.` };
    }
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: quantityToAdd },
    });
  }

  revalidatePath("/cart");
  return { success: true };
}

async function requireCartItemOwner(cartItemId: string) {
  const session = await requireRole("BUYER_SELLER");
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true, product: { include: { inventory: true, listing: true } } },
  });
  if (!cartItem) {
    return { session, cartItem: null };
  }
  if (cartItem.cart.userId !== session.userId) {
    throw new ForbiddenError("That cart item doesn't belong to you.");
  }
  return { session, cartItem };
}

export async function updateCartItemQuantityAction(cartItemId: string, quantity: number): Promise<ActionResult> {
  const parsed = updateCartItemSchema.safeParse({ cartItemId, quantity });
  if (!parsed.success) {
    return { success: false, error: "Invalid quantity." };
  }

  const { cartItem } = await requireCartItemOwner(parsed.data.cartItemId);
  if (!cartItem) {
    return { success: false, error: "This cart item no longer exists." };
  }

  if (cartItem.product.type === "USER_LISTING") {
    return { success: false, error: "Marketplace listings are limited to quantity 1 — remove and re-add instead." };
  }

  if (cartItem.product.inventory && parsed.data.quantity > cartItem.product.inventory.stock) {
    return { success: false, error: `Only ${cartItem.product.inventory.stock} left in stock.` };
  }

  await prisma.cartItem.update({
    where: { id: cartItem.id },
    data: { quantity: parsed.data.quantity },
  });

  revalidatePath("/cart");
  return { success: true };
}

export async function removeFromCartAction(cartItemId: string): Promise<ActionResult> {
  const { cartItem } = await requireCartItemOwner(cartItemId);
  if (!cartItem) {
    return { success: true }; // already gone — removing a nonexistent item is a no-op success, not an error
  }

  await prisma.cartItem.delete({ where: { id: cartItem.id } });

  revalidatePath("/cart");
  return { success: true };
}
