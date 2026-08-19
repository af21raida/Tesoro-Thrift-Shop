import type { Prisma } from "@prisma/client";

/**
 * Phase 12: the app's display currency changed from USD to Bangladeshi
 * Taka. This is a display-layer change only — every price/amount in the
 * database is still a Postgres `Decimal` (see prisma/schema.prisma's
 * `@db.Decimal(10, 2)` columns) and every calculation still uses
 * `Prisma.Decimal` arithmetic (lib/auction/bidding.ts,
 * lib/inventory/stock.ts, lib/orders/create-order.ts, ...) end to end —
 * nothing here changes storage, and nothing here introduces floating-point
 * money math. This function is purely "take a Decimal/number/numeric
 * string and render it as a Taka amount," called at the point of display.
 *
 * Accepts `Prisma.Decimal | number | string` because callers hold amounts
 * in all three forms depending on where they came from: a fresh Prisma
 * read (`Decimal`), a `.toNumber()`'d aggregate (`number`), or an
 * already-`.toFixed(2)`'d value threaded through a page (`string`).
 *
 * `en-US` locale is used only for its digit-grouping (1,500.00) — Node's
 * default small-icu build reliably has `en-US` available, which isn't
 * guaranteed for `bn-BD`; the ৳ symbol is prefixed manually instead of
 * relying on a locale's currency formatting to supply it.
 */
export function formatCurrency(amount: Prisma.Decimal | number | string): string {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  const formatted = numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳${formatted}`;
}
