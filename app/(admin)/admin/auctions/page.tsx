import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionStatusBadge } from "@/components/auctions/auction-status-badge";
import { ApproveAuctionButton } from "@/components/auctions/approve-auction-button";
import { CancelAuctionButton } from "@/components/auctions/cancel-auction-button";
import { CloseExpiredButton } from "@/components/auctions/close-expired-button";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function AdminAuctionsPage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /admin/* to
  // ADMIN, but this page checks for itself too — same convention every
  // other role-gated page has followed since Phase 4.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/auctions");
  }

  const auctions = await prisma.auction.findMany({
    include: { product: true, winner: { select: { name: true } }, _count: { select: { bids: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Auctions</span>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Manage auctions</h1>
        <div className="flex items-center gap-3">
          <CloseExpiredButton />
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Live/upcoming auctions with bids can no longer be edited or cancelled — see{" "}
        <Link href="/admin/bids" className="underline hover:text-ink">
          Monitor bids
        </Link>{" "}
        for the full bid feed.
      </p>

      {auctions.length === 0 ? (
        <p className="mt-8 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No auctions yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-tag border border-line">
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
                  <td className="px-4 py-3 font-mono">
                    {auction._count.bids > 0
                      ? formatCurrency(auction.currentHighestBid!.toString())
                      : "No bids yet"}
                  </td>
                  <td className="px-4 py-3">{auction._count.bids}</td>
                  <td className="px-4 py-3 text-ink-soft">{auction.winner?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{auction.endTime.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      {auction.status === "PENDING" && (
                        <ApproveAuctionButton auctionId={auction.id} productName={auction.product.name} />
                      )}
                      {(auction.status === "UPCOMING" || auction.status === "PENDING") &&
                        auction._count.bids === 0 && (
                          <Link
                            href={`/admin/auctions/${auction.id}/edit`}
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
