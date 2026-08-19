"use client";

import { useState, useTransition } from "react";
import { approveListingAction } from "@/actions/listings/moderate-listing";
import { Button } from "@/components/ui/button";

export function ApproveListingButton({ listingId }: { listingId: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await approveListingAction(listingId);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Approving…" : "Approve"}
      </Button>
      {error && <p className="max-w-[16rem] text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
