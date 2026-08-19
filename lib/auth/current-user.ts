import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "./session";

export type SafeUser = Omit<User, "passwordHash">;

/**
 * Returns the full user row (minus passwordHash) for the current session,
 * or null if unauthenticated. Use this in Server Components that need more
 * than the session's id/email/roles (e.g. createdAt for a profile page).
 * For authorization decisions inside actions, prefer the roles already on
 * the session payload via requireRole() — this does an extra DB round trip
 * and is meant for display, not gating.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
