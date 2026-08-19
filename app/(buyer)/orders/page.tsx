import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatCurrency } from "@/lib/format/currency";

export default async function OrdersPage(): Promise<React.JSX.Element> {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/orders");

  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl">My orders</h1>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No orders yet.{" "}
          <Link href="/products" className="underline hover:text-ink">
            Start browsing
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-tag border border-line bg-paper px-4 py-3 transition-colors hover:border-ink"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                    {order.createdAt.toLocaleDateString()} · {order.source === "AUCTION" ? "Auction win" : "Checkout"}
                  </span>
                  <span className="text-sm text-ink">
                    {itemCount} item{itemCount === 1 ? "" : "s"} · {formatCurrency(order.totalAmount.toString())}
                  </span>
                </div>
                <OrderStatusBadge status={order.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
