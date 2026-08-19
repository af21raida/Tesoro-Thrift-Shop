"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/validation/action-result";

/**
 * Admin "Remove Users" (Admin use-case diagram), implemented as
 * deactivation rather than a hard delete — see the `User.active` field
 * comment in schema.prisma for why. Deactivating blocks future logins
 * (actions/auth/login.ts) but does not revoke a session issued before
 * deactivation: sessions are stateless 7-day JWTs with no denylist, the
 * same limitation Phase 3's session.ts notes already call out for
 * revocation in general. A deactivated user's existing session simply
 * expires on its own schedule.
 */
export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const session = await requireRole("ADMIN");

  if (userId === session.userId) {
    return { success: false, error: "You can't deactivate your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { success: false, error: "This user no longer exists." };
  }
  // A safety guard, not a diagram requirement: prevents one admin from
  // locking another admin out (and, transitively, everyone) by mistake.
  // Reactivating another admin is still allowed — only deactivating one is blocked.
  if (!active && target.roles.includes("ADMIN")) {
    return { success: false, error: "Other admin accounts can't be deactivated from here." };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });

  revalidatePath("/admin/users");
  return { success: true };
}
