import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import type { SessionPayload } from "./types";
import { getAuthSecretBytes } from "./secret";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "thrift_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Phase 11 fix: delegates to lib/auth/secret.ts's getAuthSecretBytes, which
// now also rejects the known .env.example placeholder value, not just a
// completely missing one (see that file's docstring). Kept as a local
// wrapper so every existing call site below is unchanged.
function getSecretKey(): Uint8Array {
  return getAuthSecretBytes();
}

/**
 * Signs a session JWT and sets it as an httpOnly, secure, sameSite=lax
 * cookie. httpOnly keeps it unreadable to client-side JS (mitigates XSS
 * token theft); sameSite=lax mitigates CSRF on state-changing requests
 * originating from other sites.
 */
export async function createSession(user: {
  id: string;
  email: string;
  roles: Role[];
}): Promise<void> {
  const iat = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    roles: user.roles,
    iat,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_DURATION_SECONDS)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Reads and verifies the session cookie for the current request. Returns
 * null on any failure (missing cookie, bad signature, expired token) —
 * callers treat null as "not authenticated" rather than distinguishing
 * failure reasons, since none of them are actionable by the user.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME as SESSION_COOKIE_NAME };
