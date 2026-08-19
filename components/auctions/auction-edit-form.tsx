"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateAuctionAction } from "@/actions/auction/update-auction";
import type { ActionResult } from "@/lib/validation/action-result";

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function AuctionEditForm({
  auctionId,
  defaultValues,
}: {
  auctionId: string;
  defaultValues: { startingPrice: string; minIncrement: string; startTime: string; endTime: string };
}): React.JSX.Element {
  const boundAction = updateAuctionAction.bind(null, auctionId);
  const [state, formAction] = useFormState<ActionResult | null, FormData>(boundAction, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Starting price (৳)"
          name="startingPrice"
          errors={fieldErrors?.startingPrice}
          defaultValue={defaultValues.startingPrice}
        />
        <Field
          label="Minimum bid increment (৳)"
          name="minIncrement"
          errors={fieldErrors?.minIncrement}
          defaultValue={defaultValues.minIncrement}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Start time"
          name="startTime"
          type="datetime-local"
          errors={fieldErrors?.startTime}
          defaultValue={defaultValues.startTime}
        />
        <Field
          label="End time"
          name="endTime"
          type="datetime-local"
          errors={fieldErrors?.endTime}
          defaultValue={defaultValues.endTime}
        />
      </div>
      {state && !state.success && !fieldErrors && <p className="text-xs text-stamp">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
