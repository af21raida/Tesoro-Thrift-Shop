import type { TransactionStatus } from "@prisma/client";

const STATUS_STYLES: Record<TransactionStatus, string> = {
  PENDING: "border-brass text-brass-dark",
  SUCCESS: "border-market text-market",
  FAILED: "border-stamp text-stamp",
  REFUNDED: "border-plum text-plum",
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: "Pending",
  SUCCESS: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }): React.JSX.Element {
  return <span className={`tag-badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
