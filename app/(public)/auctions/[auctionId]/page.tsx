import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { ensureAuctionActivated, ensureAuctionFinalized } from "@/lib/auction/closing";
import { AuctionStatusBadge } from "@/components/auctions/auction-status-badge";
import { CountdownTimer } from "@/components/auctions/countdown-timer";
import { ConditionBadge } from "@/components/products/condition-badge";
import { BidForm } from "@/components/auctions/bid-form";
import { canShop } from "@/lib/auth/rbac";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { auctionId: string };
}

export default async function AuctionDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const existing = await prisma.auction.findUnique({
    where: { id: params.auctionId },
    select: { id: true, status: true, startTime: true, endTime: true },
  });
  if (!existing) notFound();

  // See lib/auction/closing.ts — activates this specific auction inline
  // if its start time has arrived, then closes it if its end time has
  // also passed, before we read it below for rendering, so neither a
  // stale UPCOMING nor a stale "Live" status is ever shown here.
  await ensureAuctionActivated(existing);
  await ensureAuctionFinalized(existing);

  const auction = await prisma.auction.findUnique({
    where: { id: params.auctionId },
    include: {
      product: { include: { category: true } },
      winner: { select: { id: true, name: true } },
      bids: {
        orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
        take: 20,
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { bids: true } },
    },
  });
  if (!auction) notFound();

  const session = await getSession();
  const hasBids = auction._count.bids > 0;
  const currentHighest = auction.currentHighestBid?.toString() ?? auction.startingPrice.toString();
  // Matches lib/auction/bidding.ts's guard exactly: the floor is
  // startingPrice before any bid exists (a first bid may meet it exactly),
  // or currentHighestBid once one does (a later bid must be strictly
  // higher — the smallest such amount is one cent above it, since bids
  // are stored to 2 decimal places). No fixed minimum increment.
  const bidFloor = auction.currentHighestBid ?? auction.startingPrice;
  const minimumNextBid = (auction.currentHighestBid ? bidFloor.add("0.01") : bidFloor).toFixed(2);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <Link href="/auctions" className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
        ← All auctions
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14">
        <div className="grid grid-cols-2 gap-2">
          {auction.product.images.length > 0 ? (
            auction.product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured hosts; see next.config.mjs note
              <img
                key={image}
                src={image}
                alt={auction.product.name}
                className="aspect-square w-full rounded-tag border border-plum object-cover"
              />
            ))
          ) : (
            <div className="col-span-2 flex aspect-square items-center justify-center rounded-tag border border-plum bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <AuctionStatusBadge status={auction.status} />
            <ConditionBadge condition={auction.product.condition} />
            <Link
              href={`/categories/${auction.product.category.slug}`}
              className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              {auction.product.category.name}
            </Link>
          </div>

          <h1 className="text-3xl">{auction.product.name}</h1>
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-soft">{auction.product.description}</p>

          <div className="grid grid-cols-2 gap-4 rounded-tag border border-line bg-paper-dim p-5 font-mono text-base">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Starting price</p>
              <p className="font-semibold text-ink">{formatCurrency(auction.startingPrice.toString())}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Current highest bid</p>
              <p className="font-semibold text-plum">{hasBids ? formatCurrency(currentHighest) : "No bids yet"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Bids</p>
              <p className="text-ink">{auction._count.bids}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                {auction.status === "UPCOMING"
                  ? "Starts"
                  : auction.status === "ACTIVE"
                    ? "Ends"
                    : auction.status === "PENDING"
                      ? "Pending"
                      : "Closed"}
              </p>
              {auction.status === "UPCOMING" && <CountdownTimer target={auction.startTime.toISOString()} label="in" />}
              {auction.status === "ACTIVE" && <CountdownTimer target={auction.endTime.toISOString()} label="in" />}
              {auction.status === "PENDING" && (
                <p className="text-ink-soft">Awaiting admin approval — not open for bidding yet.</p>
              )}
              {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                <p className="text-ink-soft">{auction.endTime.toLocaleString()}</p>
              )}
            </div>
          </div>

          {auction.status === "ACTIVE" &&
            (session && canShop(session) ? (
              <BidForm auctionId={auction.id} minimumNextBid={minimumNextBid} />
            ) : session ? (
              <p className="text-sm text-ink-soft">Admin and staff accounts can&apos;t place bids.</p>
            ) : (
              <p className="text-sm text-ink-soft">
                <Link href="/login" className="underline hover:text-ink">
                  Log in
                </Link>{" "}
                to place a bid.
              </p>
            ))}

          {auction.status === "UPCOMING" && (
            <p className="rounded-tag border border-brass bg-brass/5 px-3 py-2 text-sm text-brass-dark">
              Bidding opens once the auction starts — start time above.
            </p>
          )}

          {auction.status === "PENDING" && (
            <p className="rounded-tag border border-brass bg-brass/5 px-3 py-2 text-sm text-brass-dark">
              This auction is awaiting admin approval and is not open for bidding yet.
            </p>
          )}

          {auction.status === "ENDED" && (
            <p className="rounded-tag border border-market bg-market/5 px-3 py-2 text-sm text-market">
              {auction.winner
                ? `Sold to ${auction.winner.name} for ${formatCurrency(currentHighest)}.`
                : "Auction ended with no bids."}
            </p>
          )}

          {auction.status === "CANCELLED" && (
            <p className="rounded-tag border border-stamp bg-stamp/5 px-3 py-2 text-sm text-stamp">
              This auction was cancelled by an admin before it received any bids.
            </p>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg">Bid history</h2>
        {auction.bids.length === 0 ? (
          <p className="mt-2 text-base text-ink-soft">No bids yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-tag border border-line">
            <table className="w-full text-left text-base">
              <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-2">Bidder</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {auction.bids.map((bid) => (
                  <tr key={bid.id} className="border-b border-line last:border-0">
                    {/* First name only — this table is public, so full name/email stays out per the brief's "don't expose unnecessary sensitive bidder information." Full identity is visible to admins on /admin/bids. */}
                    <td className="px-4 py-2 text-ink-soft">{bid.user.name.split(" ")[0]}</td>
                    <td className="px-4 py-2 font-mono font-semibold text-ink">{formatCurrency(bid.amount.toString())}</td>
                    <td className="px-4 py-2 text-ink-soft">{bid.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
