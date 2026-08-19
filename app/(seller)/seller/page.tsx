import Link from "next/link";
import { redirect } from "next/navigation";
import type { ListingStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const STATUS_ORDER: ListingStatus[] = ["PENDING", "APPROVED", "ACTIVE", "REJECTED", "SOLD", "REMOVED"];

export default async function SellerDashboardPage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /seller/* to the
  // SELLER role, but this page checks for itself too — same convention as
  // every other role-gated page since Phase 4.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect("/login?redirectTo=/seller");
  }

  const counts = await prisma.listing.groupBy({
    by: ["status"],
    where: { sellerId: user.id },
    _count: true,
  });
  const countByStatus = new Map(counts.map((row) => [row.status, row._count]));
  const total = counts.reduce((sum, row) => sum + row._count, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Listings</span>
      <h1 className="mt-2 text-2xl">Seller dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Welcome back, {user.name}. You have {total} listing{total === 1 ? "" : "s"} on record.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-tag border border-line px-4 py-3">
            <p className="font-mono text-2xl text-ink">{countByStatus.get(status) ?? 0}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{status.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/seller/listings"
          className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          View my listings
        </Link>
        <Link
          href="/seller/listings/create"
          className="rounded-tag bg-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-market-dark"
        >
          + New listing
        </Link>
        {/* Phase 12 addition: auctions are a separate resource from
            listings (own model, own ownership check), so they get their
            own link here rather than being folded into the listings
            buttons above — see app/(seller)/seller/auctions/page.tsx. */}
        <Link
          href="/seller/auctions"
          className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          View my auctions
        </Link>
        <Link
          href="/seller/auctions/new"
          className="rounded-tag bg-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-market-dark"
        >
          + New auction
        </Link>
      </div>
    </div>
  );
}
