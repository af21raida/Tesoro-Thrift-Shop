import "server-only";
import type { Role } from "@prisma/client";
import { getSession } from "./session";
import type { SessionPayload } from "./types";

/**
 * These throw rather than return a result, deliberately: every Server
 * Action and Route Handler that mutates data (bids, checkout, listing
 * approval, ...) should call one of these as its first line, and let the
 * thrown error short-circuit execution. Hiding a button on the frontend is
 * not authorization — this is the actual enforcement point.
 */

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be logged in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws if there is no valid session. Returns the session payload otherwise. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

/** Throws unless the current user holds at least one of `allowedRoles`. */
export async function requireRole(
  ...allowedRoles: Role[]
): Promise<SessionPayload> {
  const session = await requireUser();
  const hasRole = session.roles.some((role) => allowedRoles.includes(role));
  if (!hasRole) throw new ForbiddenError();
  return session;
}

/**
 * ADMIN and STAFF are management roles, not shopping roles: they should
 * never see "Add to Cart" or "Place Bid" controls, even if (unusually)
 * their account also carries BUYER_SELLER. This is a UI-gating helper
 * only — the real enforcement is still requireRole("BUYER_SELLER") inside
 * the cart/bid Server Actions themselves; this just keeps the button from
 * being shown in the first place.
 */
export function canShop(session: Pick<SessionPayload, "roles">): boolean {
  return !session.roles.includes("ADMIN") && !session.roles.includes("STAFF");
}

/**
 * Throws unless the current user is either the resource owner
 * (`resourceOwnerId`) or holds one of `overrideRoles` (e.g. ADMIN).
 * Used for "users can't modify other users' listings/bids/orders" checks.
 */
export async function requireOwnerOrRole(
  resourceOwnerId: string,
  ...overrideRoles: Role[]
): Promise<SessionPayload> {
  const session = await requireUser();
  const isOwner = session.userId === resourceOwnerId;
  const hasOverride = session.roles.some((role) => overrideRoles.includes(role));
  if (!isOwner && !hasOverride) throw new ForbiddenError();
  return session;
}
