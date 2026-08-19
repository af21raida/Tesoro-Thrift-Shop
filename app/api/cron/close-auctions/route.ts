import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { activateDueAuctions, closeExpiredAuctions } from "@/lib/auction/closing";
import { isKnownPlaceholderSecret } from "@/lib/auth/secret";

/**
 * The path and `CRON_SECRET` env var were already scaffolded in
 * `.env.example` back in Phase 3, anticipating exactly this: an external
 * scheduler calls this with `Authorization: Bearer <CRON_SECRET>` instead
 * of an admin browser session, since a cron trigger has no cookie to send.
 * An authenticated ADMIN session is accepted too, so the "Close expired
 * auctions" button on /admin/auctions (actions/auction/close-expired.ts)
 * can keep working without needing its own secret.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  // Phase 11 fix (audit issue #5): previously only checked Boolean(cronSecret)
  // before comparing, which is safe against a completely unset value (falls
  // through to requireRole("ADMIN") below) but not against a deployment that
  // left CRON_SECRET as the exact placeholder string .env.example ships —
  // that value is public, so accepting it here would let anyone finalize
  // auctions without an admin session. Reuses the same placeholder list
  // lib/auth/secret.ts already maintains for AUTH_SECRET, rather than
  // duplicating the known-placeholder string in a second place.
  const hasValidCronSecret =
    Boolean(cronSecret) && !isKnownPlaceholderSecret(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!hasValidCronSecret) {
    try {
      await requireRole("ADMIN");
    } catch {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  // Activation before closing, same order the lazy per-page-load checks
  // use — an auction whose startTime and endTime both already passed
  // between cron ticks still needs to end up ENDED either way (see
  // closeExpiredAuctions' widened UPCOMING+ACTIVE query), but activating
  // first keeps this route doing the same two-step sweep on every tick
  // rather than depending on call order.
  const activated = await activateDueAuctions();
  const results = await closeExpiredAuctions();
  return NextResponse.json({ activated, closed: results.length, results });
}
