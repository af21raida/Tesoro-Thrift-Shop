"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { decrementStock, InsufficientStockError } from "@/lib/inventory/stock";
import { createOrderRecord } from "@/lib/orders/create-order";
import type { ActionResult } from "@/lib/validation/action-result";

class ListingUnavailableError extends Error {
  constructor(productName: string) {
    super(`"${productName}" is no longer available — someone else may have just bought it.`);
    this.name = "ListingUnavailableError";
  }
}

/**
 * Implements the corrected Buyer Checkout flow from the Phase 1 analysis
 * (Section F.4): the original sequence diagram omits inventory checking,
 * order-item creation, and failure branching entirely. This is that
 * missing guarded, transactional path: stock/listing re-check -> order ->
 * order items -> transaction -> cart clear, all inside one
 * `prisma.$transaction` so a failure at any step (out of stock, listing
 * already sold, mock payment declines) rolls back everything before it —
 * a buyer is never charged for, or shown a confirmed order for, an item
 * that didn't actually get reserved.
 *
 * No form fields: cart contents and live prices are read server-side, not
 * trusted from the client, so this only needs to know who's checking out.
 *
 * Phase 12 fix: gated on `requireRole("BUYER_SELLER")`, not `requireUser()`
 * — checkout is now a BUYER_SELLER-only action; STAFF explicitly "cannot
 * checkout" under the new role model, and ADMIN "cannot buy".
 */
export async function checkoutAction(): Promise<ActionResult> {
  const session = await requireRole("BUYER_SELLER");

  const cart = await prisma.cart.findUnique({
    where: { userId: session.userId },
    include: {
      items: {
        include: { product: { include: { inventory: true, listing: true } } },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return { success: false, error: "Your cart is empty." };
  }

  let orderId: string;
  try {
    orderId = await prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      const orderItems: Array<{ productId: string; listingId: string | null; quantity: number; unitPrice: Prisma.Decimal }> = [];

      for (const cartItem of cart.items) {
        const { product } = cartItem;

        // Re-fetch price live rather than trusting whatever was true when
        // the item was added to the cart — the whole point of re-checking
        // inside the transaction is that time has passed since then. Also
        // re-fetches listing status fresh for the same reason (Phase 12:
        // previously this used the join from the `cart.findUnique` call
        // above, which is exactly the kind of stale-at-transaction-time
        // read this comment already warned against for price).
        const current = await tx.product.findUnique({
          where: { id: product.id },
          select: { price: true, type: true, listing: { select: { id: true, status: true } } },
        });
        if (!current) {
          throw new ListingUnavailableError(product.name);
        }

        if (current.type === "THRIFT_STOCK") {
          await decrementStock(product.id, cartItem.quantity, tx);
        } else if (current.type === "USER_LISTING") {
          // Phase 12 fix: previously a listing's sole "still available"
          // signal was `Listing.status` flipping straight to SOLD here —
          // effectively a second, listing-only stock system running
          // alongside THRIFT_STOCK's Inventory-based one. Listings now
          // carry a real Inventory row too (see create-listing.ts), so
          // stock is decremented through the exact same guarded
          // `decrementStock()` call THRIFT_STOCK uses just above — one
          // stock mechanism for both product types, not two. `status`
          // still gates *public purchasability* independently of stock
          // (an unapproved/removed listing must never be buyable no
          // matter what Inventory says), so that check stays, it just no
          // longer doubles as the stock guard.
          if (!current.listing || (current.listing.status !== "APPROVED" && current.listing.status !== "ACTIVE")) {
            throw new ListingUnavailableError(product.name);
          }
          await decrementStock(product.id, cartItem.quantity, tx);
        } else {
          // AUCTION_ITEM should never reach the cart (addToCartAction
          // blocks it) — this is a defense-in-depth guard, not an
          // expected path.
          throw new ListingUnavailableError(product.name);
        }

        const unitPrice = current.price;
        totalAmount = totalAmount.add(unitPrice.mul(cartItem.quantity));
        orderItems.push({
          productId: product.id,
          listingId: product.listing?.id ?? null,
          quantity: cartItem.quantity,
          unitPrice,
        });
      }

      const { orderId: newOrderId, transactionStatus } = await createOrderRecord(tx, {
        userId: session.userId,
        source: "CHECKOUT",
        items: orderItems,
        totalAmount,
      });

      if (transactionStatus === "FAILED") {
        // Mock provider never actually returns FAILED today (see
        // lib/payments/mock-provider.ts), but the branch is real: throwing
        // here rolls back the stock decrements above along with it, so a
        // declined payment can never leave stock reserved without a
        // corresponding confirmed order.
        throw new Error("Payment failed.");
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrderId;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError || error instanceof ListingUnavailableError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Checkout failed. Please review your cart and try again." };
  }

  revalidatePath("/cart");
  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/listings");
  revalidatePath("/seller/listings");
  redirect(`/orders/${orderId}`);
}
