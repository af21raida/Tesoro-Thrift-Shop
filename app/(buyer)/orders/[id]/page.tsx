import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { TransactionStatusBadge } from "@/components/orders/transaction-status-badge";
import { formatCurrency } from "@/lib/format/currency";

interface PageProps {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const session = await getSession();
  if (!session) redirect(`/login?redirectTo=/orders/${params.id}`);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: true } },
      transaction: true,
    },
  });

  if (!order) notFound();

  // Same own-or-admin visibility rule as the product detail page: a buyer
  // can see their own orders, and ADMIN can see any order (Manage
  // Transactions on the Admin use-case diagram — the actual admin-facing
  // surface for that lands in Phase 9, but the underlying access rule is
  // established here rather than invented twice).
  const canView = order.userId === session.userId || session.roles.includes("ADMIN");
  if (!canView) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/orders" className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
        &larr; My orders
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl">Order #{order.id.slice(-8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
        {order.createdAt.toLocaleString()} · {order.source === "AUCTION" ? "Auction win" : "Checkout"}
      </p>

      <div className="mt-6 rounded-tag border border-line bg-paper">
        <div className="divide-y divide-line px-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex flex-col gap-1">
                <Link href={`/products/${item.productId}`} className="font-display text-base text-ink hover:underline">
                  {item.product.name}
                </Link>
                <span className="font-mono text-xs text-ink-soft">
                  {item.quantity} &times; {formatCurrency(item.unitPrice.toString())}
                </span>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">
                {formatCurrency(item.unitPrice.mul(item.quantity).toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total</span>
        <span className="font-mono text-xl font-semibold text-ink">{formatCurrency(order.totalAmount.toString())}</span>
      </div>

      {order.transaction && (
        <div className="mt-4 flex items-center justify-between rounded-tag border border-line bg-paper-dim px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">Payment</span>
            <span className="font-mono text-xs text-ink-soft">{order.transaction.reference}</span>
          </div>
          <TransactionStatusBadge status={order.transaction.status} />
        </div>
      )}
    </div>
  );
}
