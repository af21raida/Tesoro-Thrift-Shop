import type { OrderStatus } from "@prisma/client";

// Same token mapping as ListingStatusBadge: market (teal) for a completed
// good outcome, brass for "waiting," stamp (red) for a failed/cancelled
// terminal state.
const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "border-brass text-brass-dark",
  CONFIRMED: "border-market text-market",
  CANCELLED: "border-ink-soft text-ink-soft",
  FAILED: "border-stamp text-stamp",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }): React.JSX.Element {
  return <span className={`tag-badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
