"use client";

import { useState, useTransition } from "react";
import { checkoutAction } from "@/actions/checkout/checkout";
import { Button } from "@/components/ui/button";

/**
 * On success, `checkoutAction` calls `redirect()` — which throws internally
 * and never returns to this component, so there's no explicit "success"
 * branch to handle here, only the error one. See lib/validation/action-result.ts.
 */
export function CheckoutButton({ disabled }: { disabled?: boolean }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await checkoutAction();
            if (result && !result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Placing order…" : "Checkout"}
      </Button>
      {error && <p className="max-w-xs text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
