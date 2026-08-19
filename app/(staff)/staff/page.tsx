import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { isLowStock, isOutOfStock } from "@/lib/inventory/stock";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/staff/inventory", label: "Store inventory" },
  { href: "/staff/products", label: "Product availability" },
  { href: "/staff/products/new", label: "Add product" },
  { href: "/staff/reports", label: "Sales reports" },
];

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }): React.JSX.Element {
  return (
    <div className={`rounded-tag border p-4 ${accent ?? "border-line"}`}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-mono text-2xl text-ink">{value}</p>
    </div>
  );
}

export default async function StaffDashboardPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("STAFF")) {
    redirect("/login?redirectTo=/staff");
  }

  const rows = await prisma.inventory.findMany({ select: { stock: true, lowStockThreshold: true } });
  const lowStockCount = rows.filter((row) => isLowStock(row.stock, row.lowStockThreshold)).length;
  const outOfStockCount = rows.filter((row) => isOutOfStock(row.stock)).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Overview</span>
      <h1 className="mt-2 text-2xl">Staff dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Welcome back, {user.name}.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Products tracked" value={rows.length} />
        <MetricCard
          label="Low stock"
          value={lowStockCount}
          accent={lowStockCount > 0 ? "border-brass bg-brass/5" : undefined}
        />
        <MetricCard
          label="Out of stock"
          value={outOfStockCount}
          accent={outOfStockCount > 0 ? "border-stamp bg-stamp/5" : undefined}
        />
      </div>

      {lowStockCount > 0 && (
        <p className="mt-4 rounded-tag border border-brass bg-brass/5 px-4 py-3 text-sm text-brass-dark">
          Crossing a threshold while updating stock automatically notifies admins — see{" "}
          <Link href="/staff/inventory" className="underline">
            Store inventory
          </Link>{" "}
          to make corrections.
        </p>
      )}

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
