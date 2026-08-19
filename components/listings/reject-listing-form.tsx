"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { rejectListingAction } from "@/actions/listings/moderate-listing";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validation/action-result";

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Rejecting…" : "Confirm reject"}
    </Button>
  );
}

export function RejectListingForm({ listingId }: { listingId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const boundAction = rejectListingAction.bind(null, listingId);
  const [state, formAction] = useFormState<ActionResult | null, FormData>(boundAction, null);

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col items-end gap-1.5">
      <textarea
        name="reason"
        rows={2}
        required
        placeholder="Reason for the seller…"
        className={`w-full rounded-tag border bg-paper px-2 py-1.5 text-xs text-ink outline-none focus-visible:border-brass ${
          state && !state.success && state.fieldErrors?.reason ? "border-stamp" : "border-line"
        }`}
      />
      {state && !state.success && (
        <p className="text-right text-xs text-stamp">
          {state.fieldErrors?.reason?.[0] ?? state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
