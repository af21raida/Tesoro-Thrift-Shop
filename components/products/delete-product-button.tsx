"use client";

import { useState, useTransition } from "react";
import { deleteProductAction } from "@/actions/products/delete-product";
import { Button } from "@/components/ui/button";

export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Delete "${productName}"? This can't be undone.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteProductAction(productId);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      {error && <p className="max-w-[16rem] text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
