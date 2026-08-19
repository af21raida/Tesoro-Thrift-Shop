import { isLowStock, isOutOfStock } from "@/lib/inventory/stock";

interface StockBadgeProps {
  stock: number;
  lowStockThreshold: number;
  available: boolean;
}

export function StockBadge({ stock, lowStockThreshold, available }: StockBadgeProps): React.JSX.Element {
  if (!available) {
    return <span className="tag-badge border-ink-soft text-ink-soft">Unavailable</span>;
  }
  if (isOutOfStock(stock)) {
    return <span className="tag-badge border-stamp text-stamp">Out of stock</span>;
  }
  if (isLowStock(stock, lowStockThreshold)) {
    return <span className="tag-badge border-brass text-brass-dark">Low stock · {stock} left</span>;
  }
  return <span className="tag-badge border-market text-market">In stock · {stock}</span>;
}
