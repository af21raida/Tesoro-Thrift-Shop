import Link from "next/link";
import type { AuctionStatus } from "@prisma/client";
import { AuctionStatusBadge } from "./auction-status-badge";
import { CountdownTimer } from "./countdown-timer";
import { formatCurrency } from "@/lib/format/currency";

export interface AuctionCardData {
  id: string;
  status: AuctionStatus;
  startTime: string;
  endTime: string;
  startingPrice: string;
  currentHighestBid: string | null;
  bidCount: number;
  product: { name: string; images: string[]; condition: string | null };
}

export function AuctionCard({ auction }: { auction: AuctionCardData }): React.JSX.Element {
  const image = auction.product.images[0];
  const currentPrice = auction.currentHighestBid ?? auction.startingPrice;

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group flex flex-col overflow-hidden rounded-tag border border-line bg-paper shadow-sm transition-shadow hover:border-plum hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-paper-dim">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured hosts; see next.config.mjs note
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-wide text-ink-soft">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <AuctionStatusBadge status={auction.status} />
          <span className="font-mono text-xs text-ink-soft">
            {auction.bidCount} bid{auction.bidCount === 1 ? "" : "s"}
          </span>
        </div>
        <h3 className="font-display text-lg leading-snug text-ink">{auction.product.name}</h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-mono text-base font-semibold text-ink">{formatCurrency(currentPrice)}</span>
          {auction.status === "ACTIVE" && <CountdownTimer target={auction.endTime} label="Ends in" />}
          {auction.status === "UPCOMING" && <CountdownTimer target={auction.startTime} label="Starts in" />}
        </div>
      </div>
    </Link>
  );
}
