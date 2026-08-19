import { prisma } from "@/lib/db/prisma";
import { activateDueAuctions, closeExpiredAuctions } from "@/lib/auction/closing";
import { AuctionCard } from "@/components/auctions/auction-card";

export const dynamic = "force-dynamic";

export default async function AuctionsPage(): Promise<React.JSX.Element> {
  // Lazily activate anything whose startTime has arrived, then finalize
  // anything that reached its end time, since the last visit — so this
  // list never shows an auction stuck at UPCOMING past its start, nor a
  // "Live" auction whose clock has actually already run out. See
  // lib/auction/closing.ts.
  await activateDueAuctions();
  await closeExpiredAuctions();

  const auctions = await prisma.auction.findMany({
    where: { status: { in: ["UPCOMING", "ACTIVE"] } },
    include: { product: true, _count: { select: { bids: true } } },
    orderBy: [{ status: "asc" }, { endTime: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <span className="tag-badge w-fit text-plum">Auctions</span>
      <h1 className="mt-2 text-3xl">Live &amp; upcoming auctions</h1>
      <p className="mt-1 text-sm text-ink-soft">Limited-edition items, sold to the highest bidder.</p>

      {auctions.length === 0 ? (
        <p className="mt-8 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No live or upcoming auctions right now.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={{
                id: auction.id,
                status: auction.status,
                startTime: auction.startTime.toISOString(),
                endTime: auction.endTime.toISOString(),
                startingPrice: auction.startingPrice.toString(),
                currentHighestBid: auction.currentHighestBid?.toString() ?? null,
                bidCount: auction._count.bids,
                product: {
                  name: auction.product.name,
                  images: auction.product.images,
                  condition: auction.product.condition,
                },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
