"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validation/action-result";

type CategoryFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface CategoryFormProps {
  action: CategoryFormAction;
  submitLabel: string;
  defaultValues?: { name: string; description: string };
  onSuccess?: () => void;
}

function SubmitButton({ label }: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="text-[11px]">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function CategoryForm({ action, submitLabel, defaultValues }: CategoryFormProps): React.JSX.Element {
  const [state, formAction] = useFormState(action, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Field label="Name" name="name" errors={fieldErrors?.name} defaultValue={defaultValues?.name} />
      </div>
      <div className="flex flex-1 min-w-[12rem] flex-col gap-1.5">
        <label htmlFor="description" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Description
        </label>
        <input
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          className="rounded-tag border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        />
      </div>
      <SubmitButton label={submitLabel} />
      {state && !state.success && (
        <p role="alert" className="w-full text-xs text-stamp">
          {state.error}
        </p>
      )}
    </form>
  );
}
