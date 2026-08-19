const LABELS: Record<string, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

export function ConditionBadge({ condition }: { condition: string | null }): React.JSX.Element | null {
  if (!condition) return null;
  return <span className="tag-badge text-ink-soft">{LABELS[condition] ?? condition}</span>;
}
