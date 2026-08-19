import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function BidHistoryPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/bids/history");

  const bids = await prisma.bid.findMany({
    where: { userId: user.id },
    include: { auction: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="tag-badge text-plum">Auctions</span>
      <h1 className="mt-2 text-2xl">Bid history</h1>
      <p className="mt-1 text-sm text-ink-soft">Every bid you&apos;ve placed, most recent first — nothing is ever removed once accepted.</p>

      {bids.length === 0 ? (
        <p className="mt-8 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No bids placed yet.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Your bid</th>
                <th className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/auctions/${bid.auctionId}`} className="hover:underline">
                      {bid.auction.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-ink">{formatCurrency(bid.amount.toString())}</td>
                  <td className="px-4 py-3 text-ink-soft">{bid.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
