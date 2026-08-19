import type { AuctionStatus } from "@prisma/client";

// Same token mapping convention as ListingStatusBadge/OrderStatusBadge:
// brass for "waiting," plum for "live" (the one status unique to
// auctions — matches the tailwind.config.ts note that plum means "live
// auction"), ink-soft for a neutral terminal state, stamp for cancelled.
const STATUS_STYLES: Record<AuctionStatus, string> = {
  PENDING: "border-brass text-brass-dark",
  UPCOMING: "border-brass text-brass-dark",
  ACTIVE: "border-plum text-plum",
  ENDED: "border-ink-soft text-ink-soft",
  CANCELLED: "border-stamp text-stamp",
};

const STATUS_LABELS: Record<AuctionStatus, string> = {
  PENDING: "Pending approval",
  UPCOMING: "Upcoming",
  ACTIVE: "Live",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

export function AuctionStatusBadge({ status }: { status: AuctionStatus }): React.JSX.Element {
  return <span className={`tag-badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
