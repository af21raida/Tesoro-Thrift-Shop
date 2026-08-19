import { z } from "zod";

/**
 * 99 is an arbitrary but generous ceiling — the real limit for a given
 * product is its live stock, checked against the database in the action
 * itself (and re-checked atomically at checkout). This just keeps a
 * malformed or abusive form submission from asking for an absurd quantity.
 */
const cartQuantity = z.coerce.number().int().min(1, "Quantity must be at least 1.").max(99, "Quantity must be 99 or less.");

export const addToCartSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: cartQuantity,
});

export const updateCartItemSchema = z.object({
  cartItemId: z.string().trim().min(1),
  quantity: cartQuantity,
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
