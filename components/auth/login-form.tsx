"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/actions/auth/login";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}

export function LoginForm(): React.JSX.Element {
  const [state, formAction] = useFormState(loginAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />

      {state && !state.success && (
        <p role="alert" className="rounded-tag border border-stamp bg-stamp/5 px-3 py-2 text-sm text-stamp">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
