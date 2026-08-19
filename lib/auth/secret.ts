/**
 * Deliberately has no "server-only" import: unlike lib/auth/session.ts,
 * this needs to be importable from middleware.ts, which runs in the Edge
 * runtime rather than the Node runtime the rest of lib/auth/ assumes.
 *
 * Phase 11 audit issues #5 and #8: lib/auth/session.ts's getSecretKey()
 * already threw on a completely missing AUTH_SECRET, but not on the exact
 * placeholder string .env.example ships ("replace-with-a-long-random-string")
 * — a deployment that copied .env.example to .env without editing it would
 * sign and verify real sessions with that public, guessable value.
 * middleware.ts's own getSecretKey() was worse: it fell back to an empty
 * string instead of throwing at all. Both now go through this one check,
 * so "what counts as a usable secret" can't drift between the two places
 * that verify the same token.
 */

const KNOWN_PLACEHOLDER_SECRETS = new Set<string>([
  "replace-with-a-long-random-string",
]);

export class InsecureAuthSecretError extends Error {
  constructor(reason: "missing" | "placeholder") {
    super(
      reason === "missing"
        ? "AUTH_SECRET is not set. Copy .env.example to .env and set a real secret (openssl rand -base64 32)."
        : "AUTH_SECRET is still the placeholder value from .env.example. Generate a real secret (openssl rand -base64 32) and set it before running the app.",
    );
    this.name = "InsecureAuthSecretError";
  }
}

/** Never logs or returns the secret on the failure paths — only which kind of failure occurred. */
export function isKnownPlaceholderSecret(value: string | undefined): boolean {
  return value !== undefined && KNOWN_PLACEHOLDER_SECRETS.has(value);
}

/**
 * Throws rather than falling back to any default — there is no safe
 * substitute for a real signing secret, so every caller (session-signing
 * in Node, session-verification in both Node and Edge) needs to handle
 * this failing closed rather than silently proceeding.
 */
export function getAuthSecretBytes(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new InsecureAuthSecretError("missing");
  if (isKnownPlaceholderSecret(secret)) throw new InsecureAuthSecretError("placeholder");
  return new TextEncoder().encode(secret);
}
