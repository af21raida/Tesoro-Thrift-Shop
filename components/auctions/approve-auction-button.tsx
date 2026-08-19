"use client";

import { useState, useTransition } from "react";
import { approveAuctionAction } from "@/actions/auction/approve-auction";
import { Button } from "@/components/ui/button";

export function ApproveAuctionButton({
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
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Approve the auction for "${productName}"? It will go live once it starts.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await approveAuctionAction(auctionId);
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