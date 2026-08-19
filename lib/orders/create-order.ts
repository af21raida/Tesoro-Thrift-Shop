import "server-only";
import type { Prisma, OrderSource } from "@prisma/client";
import { charge } from "@/lib/payments/mock-provider";

export interface OrderItemInput {
  productId: string;
  /** Set only when this line came from a seller's marketplace listing. */
  listingId?: string | null;
  quantity: number;
  /** Snapshotted at order time — later price changes must never retroactively change what was paid. */
  unitPrice: Prisma.Decimal | number | string;
}

export interface CreateOrderInput {
  userId: string;
  source: OrderSource;
  /** Set only for source = AUCTION (Phase 8); enforces the one-order-per-auction unique constraint. */
  auctionId?: string | null;
  items: OrderItemInput[];
  totalAmount: Prisma.Decimal | number | string;
}

export interface CreateOrderResult {
  orderId: string;
  transactionStatus: "SUCCESS" | "FAILED";
}

/**
 * Creates the `Order` + `OrderItem` rows, charges the mock payment
 * provider, and records the `Transaction`, all against the caller's own
 * `Prisma.TransactionClient` (`tx`) — never the module-level `prisma`
 * client — so this is atomic with whatever else the caller already did in
 * the same transaction (checkout.ts's stock decrements / listing
 * SOLD-transitions; the Phase 8 closing job's auction-row lock and
 * `status = ENDED` update). If the whole `$transaction` callback throws
 * after this returns, every write here — Order, OrderItems, Transaction —
 * rolls back with it.
 *
 * Deliberately does NOT validate stock, listing status, or auction state.
 * Checkout and auction finalization have completely different rules for
 * what's purchasable and when (cart-quantity limits vs. a single winning
 * bid), so that validation stays with each caller; this function only
 * knows how to record a sale once the caller has already decided it's
 * allowed to happen.
 */
export async function createOrderRecord(
  tx: Prisma.TransactionClient,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const order = await tx.order.create({
    data: {
      userId: input.userId,
      source: input.source,
      auctionId: input.auctionId ?? undefined,
      totalAmount: input.totalAmount,
      status: "PENDING",
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          listingId: item.listingId ?? undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
  });

  const paymentResult = await charge(input.totalAmount);

  await tx.transaction.create({
    data: {
      orderId: order.id,
      amount: input.totalAmount,
      status: paymentResult.status,
      reference: paymentResult.reference,
    },
  });

  await tx.order.update({
    where: { id: order.id },
    data: { status: paymentResult.status === "SUCCESS" ? "CONFIRMED" : "FAILED" },
  });

  return { orderId: order.id, transactionStatus: paymentResult.status };
}
