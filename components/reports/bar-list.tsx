/**
 * A minimal CSS-only horizontal bar chart — no charting library, per the
 * brief's "avoid unnecessary dependencies." Bars are just divs whose width
 * is a percentage of the largest value in the set; good enough for a
 * report page that needs to show relative scale, not precise plotting.
 */
export interface BarListItem {
  label: string;
  value: number;
  displayValue: string;
}

export function BarList({ items }: { items: BarListItem[] }): React.JSX.Element {
  const max = Math.max(1, ...items.map((item) => item.value));

  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">No data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate font-mono text-xs text-ink-soft" title={item.label}>
            {item.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-tag bg-paper-dim">
            <div
              className="h-full rounded-tag bg-market"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xs text-ink">{item.displayValue}</span>
        </div>
      ))}
    </div>
  );
}
