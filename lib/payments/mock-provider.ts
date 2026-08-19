import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export interface ChargeResult {
  status: "SUCCESS" | "FAILED";
  reference: string;
}

/**
 * `PaymentProvider` is the seam a real gateway (Stripe, etc.) drops into
 * later without touching any caller — checkout.ts and the Phase 8 auction
 * closing job only ever depend on this shape, never on `MockProvider`
 * directly. Matches the Phase 1 analysis's explicit call for a swappable
 * payment interface and the `Transaction` schema's
 * `provider`/`status`/`reference` columns, which exist for exactly this.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(amount: Prisma.Decimal | number | string): Promise<ChargeResult>;
}

/**
 * Always succeeds. There's no real card/gateway to decline against at this
 * project's scope, and a randomized failure would make checkout flakily
 * fail in a way that's confusing to grade rather than useful to
 * demonstrate. The `status`/`reference` shape is still threaded through
 * for real — `createOrderRecord` (lib/orders/create-order.ts) branches on
 * `status` and would mark the Order `FAILED` and roll back the whole
 * checkout transaction if this ever returned `FAILED`, exactly as it would
 * for a real declined payment — that branch is real code, just never
 * reachable through this mock.
 */
class MockProvider implements PaymentProvider {
  readonly name = "MOCK";

  async charge(amount: Prisma.Decimal | number | string): Promise<ChargeResult> {
    void amount;
    return { status: "SUCCESS", reference: `MOCK-${randomUUID()}` };
  }
}

export const paymentProvider: PaymentProvider = new MockProvider();

/** Convenience re-export so callers that only need a charge don't have to import the singleton. */
export async function charge(amount: Prisma.Decimal | number | string): Promise<ChargeResult> {
  return paymentProvider.charge(amount);
}
