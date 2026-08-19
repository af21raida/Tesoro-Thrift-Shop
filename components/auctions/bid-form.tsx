"use client";

import { useState, useTransition } from "react";
import { placeBidAction } from "@/actions/auction/place-bid";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";

interface BidFormProps {
  auctionId: string;
  /** Decimal string, e.g. "5100.00" — a UX hint pre-filling the input, not a trust boundary. The server re-derives and re-checks this itself. */
  minimumNextBid: string;
}

export function BidForm({ auctionId, minimumNextBid }: BidFormProps): React.JSX.Element {
  const [amount, setAmount] = useState(minimumNextBid);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-tag border border-plum bg-plum/5 p-4">
      <label htmlFor="bid-amount" className="font-mono text-xs uppercase tracking-wide text-plum">
        Your bid — any amount from {formatCurrency(minimumNextBid)}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="bid-amount"
          type="number"
          step="0.01"
          min={minimumNextBid}
          value={amount}
          onChange={(event) => {
            setPlaced(false);
            setAmount(event.target.value);
          }}
          className="w-40 rounded-tag border border-line bg-paper px-3 py-2 font-mono text-base text-ink outline-none focus-visible:border-brass"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setPlaced(false);
            startTransition(async () => {
              const result = await placeBidAction(auctionId, amount);
              if (!result.success) {
                setError(result.error);
              } else {
                setPlaced(true);
              }
            });
          }}
        >
          {isPending ? "Placing…" : "Place bid"}
        </Button>
      </div>
      {error && <p className="text-sm text-stamp">{error}</p>}
      {placed && !error && <p className="text-sm text-market">Bid placed — you&apos;re the highest bidder.</p>}
      <p className="text-xs text-ink-soft">
        Your bid is checked against the live server-side highest bid, never what&apos;s shown on this page.
      </p>
    </div>
  );
}
