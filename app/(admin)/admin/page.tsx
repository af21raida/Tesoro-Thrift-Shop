import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { isLowStock } from "@/lib/inventory/stock";
import { getUnreadCount } from "@/lib/notifications/notify";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/auctions", label: "Auctions" },
  { href: "/admin/bids", label: "Bids" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reports", label: "Reports" },
];

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }): React.JSX.Element {
  return (
    <div className={`rounded-tag border p-4 ${accent ?? "border-line"}`}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-mono text-2xl text-ink">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin");
  }

  const [pendingListings, liveAuctions, totalUsers, unreadNotifications, productsWithInventory] = await Promise.all([
    prisma.listing.count({ where: { status: "PENDING" } }),
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { active: true } }),
    getUnreadCount(user.id),
    prisma.inventory.findMany({ select: { stock: true, lowStockThreshold: true } }),
  ]);

  const lowStockCount = productsWithInventory.filter((row) => isLowStock(row.stock, row.lowStockThreshold)).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Overview</span>
      <h1 className="mt-2 text-2xl">Admin dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Welcome back, {user.name}.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Pending listings"
          value={pendingListings}
          accent={pendingListings > 0 ? "border-brass bg-brass/5" : undefined}
        />
        <MetricCard label="Live auctions" value={liveAuctions} accent={liveAuctions > 0 ? "border-plum bg-plum/5" : undefined} />
        <MetricCard
          label="Low stock items"
          value={lowStockCount}
          accent={lowStockCount > 0 ? "border-brass bg-brass/5" : undefined}
        />
        <MetricCard label="Active users" value={totalUsers} />
        <MetricCard
          label="Unread notifications"
          value={unreadNotifications}
          accent={unreadNotifications > 0 ? "border-plum bg-plum/5" : undefined}
        />
      </div>

      <h2 className="mt-10 text-lg">Sections</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center justify-between rounded-tag border border-line px-4 py-3 hover:border-ink"
          >
            <span className="text-sm text-ink">{section.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
