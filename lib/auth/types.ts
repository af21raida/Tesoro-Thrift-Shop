import type { Role } from "@prisma/client";

/**
 * The payload stored inside the signed session JWT. Kept intentionally
 * small — it's read on every request via middleware, so it should never
 * carry anything that goes stale in a way that matters security-wise
 * (e.g. no cached permission flags beyond role, which is rarely edited).
 */
export interface SessionPayload {
  userId: string;
  email: string;
  roles: Role[];
  /** Issued-at, seconds since epoch — used for sanity checks/debugging. */
  iat: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}
