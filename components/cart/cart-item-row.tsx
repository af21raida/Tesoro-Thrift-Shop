"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removeFromCartAction, updateCartItemQuantityAction } from "@/actions/cart/cart-actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";

export interface CartItemRowData {
  id: string;
  quantity: number;
  unitPrice: string; // product.price at render time, serialized to string by the caller
  lineTotal: string;
  isEditableQuantity: boolean; // false for USER_LISTING (always qty 1)
  maxQuantity: number | null; // live stock, for THRIFT_STOCK items
  warning: string | null; // set server-side when this line can't actually be checked out right now
  product: {
    id: string;
    name: string;
    image: string | null;
  };
}

export function CartItemRow({ item }: { item: CartItemRowData }): React.JSX.Element {
  const [quantity, setQuantity] = useState(item.quantity);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-tag border border-line bg-paper-dim">
        {item.product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured hosts; see next.config.mjs note
          <img src={item.product.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase text-ink-soft">No image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/products/${item.product.id}`} className="font-display text-base text-ink hover:underline">
          {item.product.name}
        </Link>
        <span className="font-mono text-xs font-semibold text-ink-soft">{formatCurrency(item.unitPrice)} each</span>
        {item.warning && <span className="tag-badge border-stamp text-stamp w-fit">{item.warning}</span>}
        {error && <p className="text-xs text-stamp">{error}</p>}
      </div>

      {item.isEditableQuantity ? (
        <input
          type="number"
          min={1}
          max={item.maxQuantity ?? undefined}
          value={quantity}
          disabled={isPending}
          onChange={(event) => {
            const next = Number(event.target.value);
            const clamped = item.maxQuantity
              ? Math.min(Math.max(Math.trunc(next), 1), item.maxQuantity)
              : Math.max(Math.trunc(next), 1);
            setQuantity(clamped);
            setError(null);
            startTransition(async () => {
              const result = await updateCartItemQuantityAction(item.id, clamped);
              if (!result.success) setError(result.error);
            });
          }}
          className="w-16 rounded-tag border border-line bg-paper px-2 py-2 text-center font-mono text-sm text-ink"
          aria-label="Quantity"
        />
      ) : (
        <span className="font-mono text-sm text-ink-soft">Qty 1</span>
      )}

      <span className="w-20 text-right font-mono text-sm font-semibold text-ink">{formatCurrency(item.lineTotal)}</span>

      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await removeFromCartAction(item.id);
            if (!result.success) setError(result.error);
          });
        }}
      >
        Remove
      </Button>
    </div>
  );
}
