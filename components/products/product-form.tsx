"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PRODUCT_CONDITIONS } from "@/lib/validation/product";
import type { ActionResult } from "@/lib/validation/action-result";

type ProductFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface ProductFormProps {
  action: ProductFormAction;
  categories: { id: string; name: string }[];
  submitLabel: string;
  defaultValues?: {
    name: string;
    description: string;
    price: string;
    condition: string | null;
    categoryId: string;
    images: string[];
    stock: number;
    lowStockThreshold: number;
    available: boolean;
  };
}

function SubmitButton({ label }: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ProductForm({ action, categories, submitLabel, defaultValues }: ProductFormProps): React.JSX.Element {
  const [state, formAction] = useFormState(action, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" name="name" errors={fieldErrors?.name} defaultValue={defaultValues?.name} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Description <span className="normal-case text-ink-soft/70">(max 800 characters)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={800}
          defaultValue={defaultValues?.description}
          className={`rounded-tag border bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass ${
            fieldErrors?.description ? "border-stamp" : "border-line"
          }`}
        />
        {fieldErrors?.description && <p className="text-xs text-stamp">{fieldErrors.description[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (৳)" name="price" errors={fieldErrors?.price} defaultValue={defaultValues?.price} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="condition" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Condition
          </label>
          <select
            id="condition"
            name="condition"
            defaultValue={defaultValues?.condition ?? ""}
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={defaultValues?.categoryId ?? ""}
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

      <ImageUpload errors={fieldErrors?.images} existingImages={defaultValues?.images} />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Stock"
          name="stock"
          type="number"
          errors={fieldErrors?.stock}
          defaultValue={defaultValues?.stock}
        />
        <Field
          label="Low-stock threshold"
          name="lowStockThreshold"
          type="number"
          errors={fieldErrors?.lowStockThreshold}
          defaultValue={defaultValues?.lowStockThreshold ?? 5}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="available" defaultChecked={defaultValues?.available ?? true} className="h-4 w-4" />
        Available for purchase
      </label>

      {state && !state.success && !fieldErrors && (
        <p role="alert" className="rounded-tag border border-stamp bg-stamp/5 px-3 py-2 text-sm text-stamp">
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
