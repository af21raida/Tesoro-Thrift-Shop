"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PRODUCT_CONDITIONS } from "@/lib/validation/product";
import { createAuctionAction } from "@/actions/auction/create-auction";
import type { ActionResult } from "@/lib/validation/action-result";

function SubmitButton({ label }: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : label}
    </Button>
  );
}

export function AuctionForm({
  categories,
  submitLabel,
}: {
  categories: { id: string; name: string }[];
  submitLabel: string;
}): React.JSX.Element {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(createAuctionAction, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" name="name" errors={fieldErrors?.name} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Description <span className="normal-case text-ink-soft/70">(max 800 characters)</span>
        </label>
        {/* Section 10: rows dropped from 4 to 2, matching the same compact
            treatment applied to the listing form and the same 800-char
            server-side cap in lib/validation/auction.ts. */}
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={800}
          className={`rounded-tag border bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass ${
            fieldErrors?.description ? "border-stamp" : "border-line"
          }`}
        />
        {fieldErrors?.description && <p className="text-xs text-stamp">{fieldErrors.description[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="condition" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Condition
          </label>
          <select
            id="condition"
            name="condition"
            defaultValue=""
            className={`rounded-tag border bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass ${
              fieldErrors?.condition ? "border-stamp" : "border-line"
            }`}
          >
            <option value="" disabled>
              Select…
            </option>
            {PRODUCT_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {condition.replace("_", " ")}
              </option>
            ))}
          </select>
          {fieldErrors?.condition && <p className="text-xs text-stamp">{fieldErrors.condition[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue=""
            className={`rounded-tag border bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass ${
              fieldErrors?.categoryId ? "border-stamp" : "border-line"
            }`}
          >
            <option value="" disabled>
              Select…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldErrors?.categoryId && <p className="text-xs text-stamp">{fieldErrors.categoryId[0]}</p>}
        </div>
      </div>

      <ImageUpload errors={fieldErrors?.images} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starting price (৳)" name="startingPrice" errors={fieldErrors?.startingPrice} />
        <Field
          label="Minimum bid increment (৳)"
          name="minIncrement"
          errors={fieldErrors?.minIncrement}
          defaultValue="1.00"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start time" name="startTime" type="datetime-local" errors={fieldErrors?.startTime} />
        <Field label="End time" name="endTime" type="datetime-local" errors={fieldErrors?.endTime} />
      </div>

      {state && !state.success && !fieldErrors && <p className="text-xs text-stamp">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
