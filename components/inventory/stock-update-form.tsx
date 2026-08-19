"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateStockAction } from "@/actions/products/update-stock";
import { Button } from "@/components/ui/button";

interface StockUpdateFormProps {
  productId: string;
  stock: number;
  lowStockThreshold: number;
  available: boolean;
}

function SaveButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="text-[11px]">
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function StockUpdateForm({ productId, stock, lowStockThreshold, available }: StockUpdateFormProps): React.JSX.Element {
  const [state, formAction] = useFormState(updateStockAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-mono uppercase tracking-wide text-ink-soft">Stock</span>
        <input
          type="number"
          name="stock"
          min={0}
          defaultValue={stock}
          className="w-20 rounded-tag border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus-visible:border-brass"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-mono uppercase tracking-wide text-ink-soft">Low-stock at</span>
        <input
          type="number"
          name="lowStockThreshold"
          min={0}
          defaultValue={lowStockThreshold}
          className="w-20 rounded-tag border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus-visible:border-brass"
        />
      </label>

      <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
        <input type="checkbox" name="available" defaultChecked={available} className="h-4 w-4" />
        Available
      </label>

      <SaveButton />

      {state && !state.success && (
        <p role="alert" className="w-full text-xs text-stamp">
          {state.error}
        </p>
      )}
    </form>
  );
}
