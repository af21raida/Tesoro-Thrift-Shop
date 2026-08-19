import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionStatusBadge } from "@/components/auctions/auction-status-badge";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function MyBidsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/bids");

  const auctions = await prisma.auction.findMany({
    where: { bids: { some: { userId: user.id } } },
    include: {
      product: true,
      bids: { where: { userId: user.id }, orderBy: { amount: "desc" }, take: 1 },
    },
    orderBy: { endTime: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="tag-badge text-plum">Auctions</span>
      <h1 className="mt-2 text-2xl">My bids</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Auctions you&apos;ve placed a bid on.{" "}
        <Link href="/bids/history" className="underline hover:text-ink">
          View full bid history →
        </Link>
      </p>

      {auctions.length === 0 ? (
        <p className="mt-8 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          You haven&apos;t bid on anything yet.{" "}
          <Link href="/auctions" className="underline hover:text-ink">
            Browse live auctions →
          </Link>
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {auctions.map((auction) => {
            const myBid = auction.bids[0];
            const isCurrentHighest =
              myBid !== undefined && auction.currentHighestBid?.toString() === myBid.amount.toString();
            const isWinner = auction.status === "ENDED" && auction.winnerId === user.id;

            return (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="flex items-center justify-between gap-4 rounded-tag border border-line px-4 py-3 hover:border-plum"
              >
                <div>
                  <p className="text-sm text-ink">{auction.product.name}</p>
                  <p className="font-mono text-xs text-ink-soft">
                    Your highest bid: {formatCurrency(myBid?.amount.toString() ?? "0")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isWinner && <span className="tag-badge border-market text-market">Won</span>}
                  {!isWinner && auction.status === "ACTIVE" && isCurrentHighest && (
                    <span className="tag-badge border-plum text-plum">Highest</span>
                  )}
                  {!isWinner && auction.status === "ACTIVE" && !isCurrentHighest && (
                    <span className="tag-badge border-brass text-brass-dark">Outbid</span>
                  )}
                  <AuctionStatusBadge status={auction.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
