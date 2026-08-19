import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getSalesSummary,
  getRevenueByDay,
  getInventorySummary,
  getAuctionPerformance,
  getTopSellers,
  getTopBidders,
  getTopBuyers,
} from "@/lib/reports/queries";
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

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mt-10">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-3 rounded-tag border border-line p-4">{children}</div>
    </section>
  );
}

export default async function AdminReportsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/reports");
  }

  const [sales, revenueByDay, inventory, auctions, topSellers, topBidders, topBuyers] = await Promise.all([
    getSalesSummary(),
    getRevenueByDay(14),
    getInventorySummary(),
    getAuctionPerformance(),
    getTopSellers(),
    getTopBidders(),
    getTopBuyers(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Reporting</span>
      <h1 className="mt-2 text-2xl">Reports</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Everything below is queried live from the database on every load — nothing here is cached or precomputed.
      </p>

      <Section title="Sales">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Total revenue" value={formatCurrency(sales.totalRevenue)} />
          <MetricCard label="Confirmed orders" value={sales.totalOrders} />
          <MetricCard label="Avg. order value" value={formatCurrency(sales.averageOrderValue)} />
          <MetricCard
            label="Checkout vs. auction"
            value={`${sales.bySource.find((row) => row.source === "CHECKOUT")?.orders ?? 0} / ${
              sales.bySource.find((row) => row.source === "AUCTION")?.orders ?? 0
            }`}
          />
        </div>

        <h3 className="mt-6 font-mono text-xs uppercase tracking-wide text-ink-soft">Revenue, last 14 days</h3>
        <div className="mt-3">
          <BarList
            items={revenueByDay.map((point) => ({
              label: point.day,
              value: point.revenue,
              displayValue: formatCurrency(point.revenue.toFixed(2)),
            }))}
          />
        </div>
      </Section>

      <Section title="Inventory">
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
          <>
            <h3 className="mt-6 font-mono text-xs uppercase tracking-wide text-ink-soft">Lowest stock</h3>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
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
          </>
        )}
      </Section>

      <Section title="Auction performance">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <MetricCard label="Upcoming" value={auctions.countsByStatus.UPCOMING} />
          <MetricCard label="Live" value={auctions.countsByStatus.ACTIVE} />
          <MetricCard label="Ended" value={auctions.countsByStatus.ENDED} />
          <MetricCard label="Cancelled" value={auctions.countsByStatus.CANCELLED} />
          <MetricCard label="Total bids" value={auctions.totalBids} />
        </div>
        <p className="mt-4 font-mono text-sm font-semibold text-ink">Auction revenue: {formatCurrency(auctions.auctionRevenue)}</p>

        {auctions.topAuctions.length > 0 && (
          <>
            <h3 className="mt-6 font-mono text-xs uppercase tracking-wide text-ink-soft">Most-bid auctions</h3>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {auctions.topAuctions.map((auction) => (
                <li key={auction.auctionId} className="flex items-center justify-between">
                  <Link href={`/auctions/${auction.auctionId}`} className="hover:underline">
                    {auction.productName}
                  </Link>
                  <span className="font-mono text-xs text-ink-soft">
                    {auction.bidCount} bids
                    {auction.winningBid ? ` · sold ${formatCurrency(auction.winningBid)} to ${auction.winnerName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Marketplace activity">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Top sellers</h3>
            <BarList
              items={topSellers.map((seller) => ({
                label: seller.name,
                value: seller.soldListings,
                displayValue: `${seller.soldListings} sold`,
              }))}
            />
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Top bidders</h3>
            <BarList
              items={topBidders.map((bidder) => ({
                label: bidder.name,
                value: bidder.bidCount,
                displayValue: `${bidder.bidCount} bids`,
              }))}
            />
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-ink-soft">Top buyers</h3>
            <BarList
              items={topBuyers.map((buyer) => ({
                label: buyer.name,
                value: Number(buyer.totalSpent),
                displayValue: formatCurrency(buyer.totalSpent),
              }))}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
