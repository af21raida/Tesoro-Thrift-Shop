import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionStatusBadge } from "@/components/auctions/auction-status-badge";
import { CancelAuctionButton } from "@/components/auctions/cancel-auction-button";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

/**
 * Phase 12 fix: BUYER_SELLER could already create/edit/cancel their own
 * auctions at the Server Action layer (create-auction.ts, update-auction.ts,
 * cancel-auction.ts all check owner-or-admin), but had no page of their own
 * to do it from — only the admin auctions list/edit pages existed. This is
 * the seller-facing counterpart to app/(admin)/admin/auctions/page.tsx,
 * scoped to `createdById: user.id` instead of showing every auction, using
 * the same table layout as /seller/listings for a consistent seller-area
 * feel.
 *
 * Ownership is enforced at the query itself (the `where` clause below), not
 * just by hiding links — the same "hiding a button isn't authorization"
 * boundary every action in this codebase already stands on. A BUYER_SELLER
 * can never even see another user's auction row here, let alone open its
 * edit form or cancel it.
 *
 * The Cancel button reuses `CancelAuctionButton` as-is (same component the
 * admin auctions page uses) — `cancelAuctionAction` was already
 * owner-or-admin-checked, so no action-layer change was needed, only
 * wiring it into this page under the same eligibility condition the admin
 * page uses: UPCOMING or ACTIVE, zero bids.
 */
export default async function SellerAuctionsPage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /seller/* to
  // BUYER_SELLER, but this page checks for itself too — same convention as
  // every other role-gated page since Phase 4.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect("/login?redirectTo=/seller/auctions");
  }

  const auctions = await prisma.auction.findMany({
    where: { createdById: user.id },
    include: { product: true, winner: { select: { name: true } }, _count: { select: { bids: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="tag-badge text-ink-soft">Auctions</span>
          <h1 className="mt-2 text-2xl">My auctions</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Auctions you&apos;ve created and their current status. Seller-created auctions need admin approval before
            they go live. Once an auction has bids, its terms are locked in for bidders — it can no longer be edited
            or cancelled.
          </p>
        </div>
        <Link
          href="/seller/auctions/new"
          className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          + New auction
        </Link>
      </div>

      {auctions.length === 0 ? (
        <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          You haven&apos;t created any auctions yet. Create your first auction to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Highest bid</th>
                <th className="px-4 py-3">Bids</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">Ends</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {auctions.map((auction) => (
                <tr key={auction.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/auctions/${auction.id}`} className="hover:underline">
                      {auction.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <AuctionStatusBadge status={auction.status} />
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {auction._count.bids > 0
                      ? formatCurrency(auction.currentHighestBid!.toString())
                      : "No bids yet"}
                  </td>
                  <td className="px-4 py-3">{auction._count.bids}</td>
                  <td className="px-4 py-3 text-ink-soft">{auction.winner?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{auction.endTime.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        href={`/auctions/${auction.id}`}
                        className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink"
                      >
                        Open
                      </Link>
                      {(auction.status === "UPCOMING" || auction.status === "PENDING") && auction._count.bids === 0 && (
                        <Link
                          href={`/seller/auctions/${auction.id}/edit`}
                          className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink"
                        >
                          Edit
                        </Link>
                      )}
                      {(auction.status === "UPCOMING" || auction.status === "PENDING" || auction.status === "ACTIVE") &&
                        auction._count.bids === 0 && (
                          <CancelAuctionButton auctionId={auction.id} productName={auction.product.name} />
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
