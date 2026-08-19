"use client";

import { useState, useTransition } from "react";
import { cancelAuctionAction } from "@/actions/auction/cancel-auction";
import { Button } from "@/components/ui/button";

export function CancelAuctionButton({
  auctionId,
  productName,
}: {
  auctionId: string;
  productName: string;
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Cancel the auction for "${productName}"? This can't be undone.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await cancelAuctionAction(auctionId);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Cancelling…" : "Cancel"}
      </Button>
      {error && <p className="max-w-[16rem] text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
