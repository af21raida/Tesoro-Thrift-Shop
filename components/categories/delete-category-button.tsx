"use client";

import { useState, useTransition } from "react";
import { deleteCategoryAction } from "@/actions/products/category-actions";
import { Button } from "@/components/ui/button";

export function DeleteCategoryButton({ categoryId, categoryName }: { categoryId: string; categoryName: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Delete category "${categoryName}"?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteCategoryAction(categoryId);
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
