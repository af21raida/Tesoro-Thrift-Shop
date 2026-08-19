"use client";

import { useState, useTransition } from "react";
import { removeListingAction } from "@/actions/listings/moderate-listing";
import { Button } from "@/components/ui/button";

export function RemoveListingButton({ listingId, listingName }: { listingId: string; listingName: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Remove "${listingName}" from the marketplace?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await removeListingAction(listingId);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Removing…" : "Remove"}
      </Button>
      {error && <p className="max-w-[16rem] text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
