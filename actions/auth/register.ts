"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/validation/action-result";

export async function registerAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
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

  const { name, email, password } = parsed.data;

  // Race note: two concurrent registrations with the same email could both
  // pass this check before either commits. The DB-level unique constraint
  // on User.email (see prisma/schema.prisma) is the real guarantee — this
  // lookup only exists to return a friendly error instead of a raw
  // constraint-violation message on the common case.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      success: false,
      error: "An account with that email already exists.",
      fieldErrors: { email: ["An account with that email already exists."] },
    };
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  let userEmail: string;
  try {
    const user = await prisma.user.create({
      // Phase 12: public self-registration always yields the combined
      // BUYER_SELLER role — there's no separate seller sign-up step
      // anymore (becomeSellerAction is removed; every account can already
      // buy and sell/auction from the moment it's created).
      data: { name, email, passwordHash, roles: ["BUYER_SELLER"] },
    });
    userId = user.id;
    userEmail = user.email;
  } catch {
    // Catches the unique-constraint race described above.
    return {
      success: false,
      error: "An account with that email already exists.",
      fieldErrors: { email: ["An account with that email already exists."] },
    };
  }

  await createSession({ id: userId, email: userEmail, roles: ["BUYER_SELLER"] });
  redirect("/profile");
}
