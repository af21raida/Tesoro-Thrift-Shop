import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class InsufficientStockError extends Error {
  constructor() {
    super("Not enough stock available.");
    this.name = "InsufficientStockError";
  }
}

/**
 * Accepts either the module-level `prisma` client or a `Prisma.TransactionClient`
 * so this can run standalone (Phase 5 callers) or as one statement inside a
 * larger `$transaction` (Phase 7 checkout: stock check and order creation
 * for every cart line must commit or roll back together — decrementing
 * stock with the module client and creating the Order separately would let
 * one succeed while the other fails).
 */
type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Atomically decrements stock by `quantity`, guarded in the SQL statement
 * itself (`WHERE stock >= quantity`) rather than read-then-write from
 * JavaScript. This is what makes it safe under concurrent checkouts: two
 * requests racing to buy the last item can't both read stock=1, both
 * decide "ok", and both write stock=0 — only whichever UPDATE's WHERE
 * clause still matches at execution time succeeds. If zero rows match,
 * someone else already took the remaining stock (or there wasn't enough),
 * and the caller (checkout, Phase 7) should treat that as a failed sale
 * rather than retry, since retrying past the check just races again. The
 * database's own `stock >= 0` CHECK constraint (Phase 2 migration) is the
 * final backstop if this guard is ever bypassed by a raw query elsewhere.
 *
 * `available = true` is folded into the same guard so a staff member
 * flipping a product to unavailable mid-checkout is caught atomically too,
 * rather than only being checked by the caller before the transaction
 * starts (which would leave the same race the stock guard exists to close).
 */
export async function decrementStock(
  productId: string,
  quantity: number,
  client: DbClient = prisma,
): Promise<void> {
  if (quantity <= 0) return;
  const affected = await client.$executeRaw`
    UPDATE "Inventory"
    SET stock = stock - ${quantity}, "updatedAt" = now()
    WHERE "productId" = ${productId} AND stock >= ${quantity} AND available = true
  `;
  if (affected === 0) {
    throw new InsufficientStockError();
  }
}

/** Increments stock — used for restocks and for rolling back a failed order. */
export async function incrementStock(productId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  await prisma.inventory.update({
    where: { productId },
    data: { stock: { increment: quantity } },
  });
}

/**
 * Sets stock to an absolute value (the admin/staff "correct the count"
 * case, as opposed to the relative in/out adjustments above). Negative
 * values are rejected in the Zod layer before this is ever called, and the
 * DB CHECK constraint rejects them again as a last resort.
 */
export async function setStock(productId: string, stock: number): Promise<void> {
  await prisma.inventory.update({
    where: { productId },
    data: { stock },
  });
}

export function isLowStock(stock: number, lowStockThreshold: number): boolean {
  return stock <= lowStockThreshold;
}

export function isOutOfStock(stock: number): boolean {
  return stock <= 0;
}
