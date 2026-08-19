import type { ListingStatus } from "@prisma/client";

// Color mapping follows the existing design tokens (see tailwind.config.ts):
// brass for "waiting on something," market (teal) for "good," plum for
// "live," stamp (red) for "closed/rejected," ink-soft for a neutral
// terminal state.
const STATUS_STYLES: Record<ListingStatus, string> = {
  PENDING: "border-brass text-brass-dark",
  APPROVED: "border-market text-market",
  ACTIVE: "border-plum text-plum",
  REJECTED: "border-stamp text-stamp",
  SOLD: "border-ink-soft text-ink-soft",
  REMOVED: "border-ink-soft text-ink-soft",
};

const STATUS_LABELS: Record<ListingStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  SOLD: "Sold",
  REMOVED: "Removed",
};

export function ListingStatusBadge({ status }: { status: ListingStatus }): React.JSX.Element {
  return <span className={`tag-badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
