"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerAction } from "@/actions/auth/register";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function RegisterForm(): React.JSX.Element {
  const [state, formAction] = useFormState(registerAction, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" name="name" autoComplete="name" errors={fieldErrors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" errors={fieldErrors?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors?.password}
      />
      <p className="text-xs text-ink-soft">
        At least 8 characters, with a letter and a number.
      </p>

      {state && !state.success && !fieldErrors && (
        <p role="alert" className="rounded-tag border border-stamp bg-stamp/5 px-3 py-2 text-sm text-stamp">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
