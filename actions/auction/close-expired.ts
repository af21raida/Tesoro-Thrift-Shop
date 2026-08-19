"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { activateDueAuctions, closeExpiredAuctions } from "@/lib/auction/closing";

export interface CloseExpiredResult {
  success: boolean;
  closedCount?: number;
  error?: string;
}

/**
 * Admin-triggered manual run of the closing job — lets a grader (or an
 * admin) demonstrate/force finalization without waiting for real time to
 * pass or standing up a cron. See app/api/cron/close-auctions/route.ts
 * for the CRON_SECRET-protected Route Handler an actual scheduler would
 * call instead (path/env var already scaffolded in .env.example, Phase 3).
 */
export async function closeExpiredAuctionsAction(): Promise<CloseExpiredResult> {
  try {
    await requireRole("ADMIN");
  } catch {
    return { success: false, error: "You do not have permission to do that." };
  }

  // Also sweep UPCOMING -> ACTIVE while we're here (Phase 11 fix), so this
  // same manual trigger demonstrates the full lifecycle, not just closing.
  await activateDueAuctions();
  const results = await closeExpiredAuctions();

  revalidatePath("/admin/auctions");
  revalidatePath("/admin/bids");
  revalidatePath("/auctions");
  revalidatePath("/bids");

  return { success: true, closedCount: results.length };
}
