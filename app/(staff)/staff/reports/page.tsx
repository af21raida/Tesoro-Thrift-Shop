import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSalesSummary, getRevenueByDay, getInventorySummary } from "@/lib/reports/queries";
import { BarList } from "@/components/reports/bar-list";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }): React.JSX.Element {
  return (
    <div className={`rounded-tag border p-4 ${accent ?? "border-line"}`}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-mono text-2xl text-ink">{value}</p>
    </div>
  );
}

/**
 * Deliberately a subset of /admin/reports: the Staff use-case diagram's
 * "Participate in Sales Reports" sits alongside "no authority over
 * listings, auctions, or users" (Phase 1 analysis, section B) — so this
 * page reuses getSalesSummary/getInventorySummary from the same query
 * module but never calls getAuctionPerformance/getTopSellers/
 * getTopBidders/getTopBuyers, which surface auction financials and
 * per-user activity that's Admin's to see, not Staff's.
 */
export default async function StaffReportsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("STAFF")) {
    redirect("/login?redirectTo=/staff/reports");
  }

  const [sales, revenueByDay, inventory] = await Promise.all([
    getSalesSummary(),
    getRevenueByDay(14),
    getInventorySummary(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Reporting</span>
      <h1 className="mt-2 text-2xl">Sales reports</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Store-wide sales and stock figures — user and auction-financial reporting is an admin-only view.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Total revenue" value={formatCurrency(sales.totalRevenue)} />
        <MetricCard label="Confirmed orders" value={sales.totalOrders} />
        <MetricCard label="Avg. order value" value={formatCurrency(sales.averageOrderValue)} />
      </div>

      <h2 className="mt-8 text-lg">Revenue, last 14 days</h2>
      <div className="mt-3 rounded-tag border border-line p-4">
        <BarList
          items={revenueByDay.map((point) => ({
            label: point.day,
            value: point.revenue,
            displayValue: formatCurrency(point.revenue.toFixed(2)),
          }))}
        />
      </div>

      <h2 className="mt-8 text-lg">Inventory</h2>
      <div className="mt-3 rounded-tag border border-line p-4">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Units in stock" value={inventory.totalUnits} />
          <MetricCard
            label="Low stock"
            value={inventory.lowStockCount}
            accent={inventory.lowStockCount > 0 ? "border-brass bg-brass/5" : undefined}
          />
          <MetricCard
            label="Out of stock"
            value={inventory.outOfStockCount}
            accent={inventory.outOfStockCount > 0 ? "border-stamp bg-stamp/5" : undefined}
          />
        </div>

        {inventory.lowStockItems.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            {inventory.lowStockItems.map((item) => (
              <li key={item.productId} className="flex items-center justify-between">
                <Link href={`/products/${item.productId}`} className="hover:underline">
                  {item.name}
                </Link>
                <span className="font-mono text-xs text-ink-soft">
                  {item.stock} / threshold {item.lowStockThreshold}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
