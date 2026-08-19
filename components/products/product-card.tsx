import Link from "next/link";
import { ConditionBadge } from "./condition-badge";
import { StockBadge } from "@/components/inventory/stock-badge";
import { formatCurrency } from "@/lib/format/currency";

export interface ProductCardData {
  id: string;
  name: string;
  price: string; // Decimal serialized to string by the caller
  condition: string | null;
  images: string[];
  category: { name: string; slug: string };
  inventory: { stock: number; lowStockThreshold: number; available: boolean } | null;
  // Both optional and additive — every existing caller (the /products grid)
  // is unaffected; only callers that have this information (the homepage's
  // recent-listings section) need to pass it.
  sellerName?: string | null;
  /** ISO string of Product.createdAt — see homepage's docstring on why this reuses createdAt rather than adding a new field. */
  listedAt?: string;
}

export function ProductCard({ product }: { product: ProductCardData }): React.JSX.Element {
  const image = product.images[0];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-tag border border-line bg-paper shadow-sm transition-shadow hover:border-ink hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-paper-dim">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured hosts; see next.config.mjs note
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-wide text-ink-soft">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            {product.category.name}
          </span>
          {product.listedAt && (
            <span className="font-mono text-[11px] text-ink-soft">
              {new Date(product.listedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <h3 className="font-display text-lg leading-snug text-ink">{product.name}</h3>
        {product.sellerName && (
          <span className="text-sm text-ink-soft">by {product.sellerName}</span>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-mono text-base font-semibold text-ink">{formatCurrency(product.price)}</span>
          <ConditionBadge condition={product.condition} />
        </div>
        {product.inventory && (
          <StockBadge
            stock={product.inventory.stock}
            lowStockThreshold={product.inventory.lowStockThreshold}
            available={product.inventory.available}
          />
        )}
      </div>
    </Link>
  );
}
