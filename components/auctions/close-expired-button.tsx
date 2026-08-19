"use client";

import { useState, useTransition } from "react";
import { closeExpiredAuctionsAction } from "@/actions/auction/close-expired";
import { Button } from "@/components/ui/button";

/** Manual trigger for the closing job — see lib/auction/closing.ts. Auctions also lazily self-close on page view, so this exists mainly for demoing/testing finalization on demand without waiting for a page visit. */
export function CloseExpiredButton(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await closeExpiredAuctionsAction();
            setMessage(result.success ? `Closed ${result.closedCount ?? 0} auction(s).` : (result.error ?? "Failed."));
          });
        }}
      >
        {isPending ? "Closing…" : "Close expired auctions"}
      </Button>
      {message && <span className="font-mono text-xs text-ink-soft">{message}</span>}
    </div>
  );
}
