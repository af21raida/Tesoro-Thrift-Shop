"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/actions/cart/cart-actions";
import { Button } from "@/components/ui/button";

interface AddToCartButtonProps {
  productId: string;
  /** Omit for marketplace listings, which are always quantity 1 — no input is shown and the action is called with quantity 1. */
  maxQuantity?: number;
}

export function AddToCartButton({ productId, maxQuantity }: AddToCartButtonProps): React.JSX.Element {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showQuantityInput = typeof maxQuantity === "number" && maxQuantity > 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {showQuantityInput && (
          <input
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => {
              setAdded(false);
              const next = Number(event.target.value);
              setQuantity(Number.isFinite(next) ? Math.min(Math.max(Math.trunc(next), 1), maxQuantity) : 1);
            }}
            className="w-16 rounded-tag border border-line bg-paper px-2 py-2 font-mono text-sm text-ink"
            aria-label="Quantity"
          />
        )}
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setAdded(false);
            startTransition(async () => {
              const result = await addToCartAction(productId, quantity);
              if (!result.success) {
                setError(result.error);
              } else {
                setAdded(true);
              }
            });
          }}
        >
          {isPending ? "Adding…" : "Add to cart"}
        </Button>
      </div>
      {error && <p className="text-xs text-stamp">{error}</p>}
      {added && !error && <p className="text-xs text-market">Added to cart.</p>}
    </div>
  );
}
