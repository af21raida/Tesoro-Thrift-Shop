import Link from "next/link";
import { redirect } from "next/navigation";
import type { TransactionStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { TransactionStatusBadge } from "@/components/orders/transaction-status-badge";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: TransactionStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Paid", value: "SUCCESS" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
  { label: "Refunded", value: "REFUNDED" },
];

interface PageProps {
  searchParams: { status?: string };
}

export default async function AdminTransactionsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/transactions");
  }

  const requested = searchParams.status?.toUpperCase();
  const activeStatus: TransactionStatus | "ALL" =
    requested && FILTERS.some((filter) => filter.value === requested)
      ? (requested as TransactionStatus | "ALL")
      : "ALL";

  const transactions = await prisma.transaction.findMany({
    where: activeStatus === "ALL" ? {} : { status: activeStatus },
    include: { order: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Dashboards</span>
      <h1 className="mt-2 text-2xl">Payment history</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every transaction — checkout and auction wins both flow through the same table. No refund action exists yet.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/transactions?status=${filter.value}`}
            className={`rounded-tag border px-3 py-1.5 font-display font-semibold text-xs uppercase tracking-wide ${
              activeStatus === filter.value ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {transactions.length === 0 ? (
        <p className="mt-6 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No transactions in this view.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${transaction.orderId}`} className="hover:underline">
                      #{transaction.orderId.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {transaction.order.user.name}
                    <br />
                    <span className="text-xs">{transaction.order.user.email}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {transaction.order.source === "AUCTION" ? "Auction win" : "Checkout"}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-ink">{formatCurrency(transaction.amount.toString())}</td>
                  <td className="px-4 py-3">
                    <TransactionStatusBadge status={transaction.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">{transaction.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{transaction.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
