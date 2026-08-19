"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/validation/action-result";

const GENERIC_ERROR = "Incorrect email or password.";

export async function loginAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Deliberately identical error whether the email doesn't exist or the
  // password is wrong — distinguishing the two would let an attacker
  // enumerate registered emails.
  if (!user) {
    return { success: false, error: GENERIC_ERROR };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return { success: false, error: GENERIC_ERROR };
  }

  // Phase 9: deactivated accounts (Admin "Remove Users") can't start a
  // new session. This is intentionally a separate, more specific message
  // — unlike GENERIC_ERROR above, telling a real account holder their
  // account was deactivated doesn't let an attacker learn anything they
  // couldn't already infer from a normal login attempt, and leaves them a
  // clear next step (contact an admin) instead of retrying a password
  // that was never the problem.
  if (!user.active) {
    return { success: false, error: "This account has been deactivated. Contact an administrator." };
  }

  await createSession({ id: user.id, email: user.email, roles: user.roles });
  redirect("/profile");
}
