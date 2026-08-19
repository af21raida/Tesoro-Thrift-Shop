import "server-only";
import { Prisma, type AuctionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createOrderRecord } from "@/lib/orders/create-order";
import { notify } from "@/lib/notifications/notify";
import { formatCurrency } from "@/lib/format/currency";

export type FinalizeOutcome = "ALREADY_FINALIZED" | "NO_BIDS" | "WINNER_RECORDED";

export interface FinalizeResult {
  auctionId: string;
  outcome: FinalizeOutcome;
  winnerId?: string;
  orderId?: string;
}

/**
 * Closes one auction past its end time: no new bids can be accepted once
 * `status` leaves ACTIVE (lib/auction/bidding.ts's guarded UPDATE requires
 * `status = 'ACTIVE'`), the highest valid bid's bidder becomes the winner,
 * bid history is left untouched, and — if there was a winner — an
 * AUCTION-source Order/Transaction is created via the same
 * `createOrderRecord` helper Phase 7 checkout uses.
 *
 * IDEMPOTENCY (test 11 in the Phase 8 brief) is enforced two ways:
 *
 * 1. Row lock, in-process: `SELECT ... FOR UPDATE` on the Auction row
 *    inside the transaction serializes concurrent finalize calls for the
 *    *same* auction. If this function is somehow invoked twice at once
 *    (e.g. an overlapping cron trigger and a lazy page-load check), the
 *    second call blocks on the lock until the first commits, then re-reads
 *    `status`, sees `ENDED`, and exits through ALREADY_FINALIZED without
 *    touching anything.
 * 2. Database constraint, cross-process: even if two *separate* Postgres
 *    connections somehow both got past step 1 (e.g. a crash mid-
 *    transaction followed by a retry racing a second trigger),
 *    `Order.auctionId` is `@unique` (Phase 2 schema, chosen specifically
 *    for this). The second `order.create` for the same auction throws a
 *    P2002 unique-constraint violation, caught below and treated as
 *    "already finalized" rather than surfaced as a real error. This is
 *    the backstop the Phase 2 notes call out this constraint for.
 *
 * Either layer alone is enough to satisfy "finalization must not create
 * two orders/transactions/winners" — they're deliberately redundant, the
 * same "don't rely on just one layer" approach Phase 3/4 used for
 * authorization (middleware + requireRole).
 */
export async function finalizeAuction(auctionId: string): Promise<FinalizeResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: AuctionStatus; endTime: Date; productId: string }>
      >`
        SELECT id, status, "endTime", "productId" FROM "Auction" WHERE id = ${auctionId} FOR UPDATE
      `;
      const auction = rows[0];

      if (!auction) {
        return { auctionId, outcome: "ALREADY_FINALIZED" as const };
      }
      if (auction.status !== "ACTIVE" && auction.status !== "UPCOMING") {
        // Already ENDED or CANCELLED — nothing to do.
        return { auctionId, outcome: "ALREADY_FINALIZED" as const };
      }
      if (new Date(auction.endTime).getTime() > Date.now()) {
        // Not due yet. closeExpiredAuctions() only calls this for auctions
        // whose endTime has passed, but a direct call for one that hasn't
        // is a no-op rather than an error — keeps this function safe to
        // call defensively (e.g. from a page load) without pre-checking.
        return { auctionId, outcome: "ALREADY_FINALIZED" as const };
      }

      const winningBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: [{ amount: "desc" }, { createdAt: "asc" }], // earliest bid wins ties
      });

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: "ENDED",
          closedAt: new Date(),
          winnerId: winningBid?.userId ?? null,
        },
      });

      if (!winningBid) {
        return { auctionId, outcome: "NO_BIDS" as const };
      }

      const { orderId } = await createOrderRecord(tx, {
        userId: winningBid.userId,
        source: "AUCTION",
        auctionId,
        items: [{ productId: auction.productId, quantity: 1, unitPrice: winningBid.amount }],
        totalAmount: winningBid.amount,
      });

      await notify(
        {
          userId: winningBid.userId,
          type: "AUCTION_WON",
          message: `You won the auction with a bid of ${formatCurrency(winningBid.amount.toFixed(2))}.`,
        },
        tx,
      );

      return { auctionId, outcome: "WINNER_RECORDED" as const, winnerId: winningBid.userId, orderId };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { auctionId, outcome: "ALREADY_FINALIZED" };
    }
    throw error;
  }
}

/**
 * Finds every ACTIVE (or still-UPCOMING — see below) auction whose
 * endTime has passed and finalizes each.
 *
 * Phase 11 fix (audit issue #1): originally this only matched
 * `status: "ACTIVE"`. Before `activateDueAuctions()` existed below, every
 * auction was permanently stuck at UPCOMING, so this correctly never had
 * anything to do. Now that auctions do transition to ACTIVE, this also
 * has to keep covering `UPCOMING` auctions whose `endTime` has *also*
 * already passed — e.g. a very short bidding window that a sweep never
 * caught mid-flight, or `activateDueAuctions()` and this function being
 * called in the "wrong" order by some future caller. `finalizeAuction`
 * itself already treats UPCOMING as finalizable (its own status check
 * predates this fix and was never the bug), so this is the query catching
 * up to what that function already allowed.
 */
export async function closeExpiredAuctions(): Promise<FinalizeResult[]> {
  const due = await prisma.auction.findMany({
    where: { status: { in: ["ACTIVE", "UPCOMING"] }, endTime: { lte: new Date() } },
    select: { id: true },
  });

  const results: FinalizeResult[] = [];
  for (const auction of due) {
    results.push(await finalizeAuction(auction.id));
  }
  return results;
}

/**
 * Flips every UPCOMING auction whose `startTime` has arrived (and whose
 * `endTime` hasn't — see `closeExpiredAuctions` above for that edge) to
 * ACTIVE, via the same "guard lives in the WHERE clause" pattern the rest
 * of this file and lib/inventory/stock.ts use: a single guarded
 * `UPDATE ... WHERE status = 'UPCOMING' AND now() >= "startTime"` can't
 * double-activate or race with a concurrent call, and never touches an
 * auction outside that specific state, so there's nothing here for
 * `placeBid`'s or `finalizeAuction`'s existing logic to be aware of —
 * both already treat `status = 'ACTIVE'` as the only biddable state and
 * `now() < endTime` as an independent check.
 *
 * Phase 11 fix (audit issue #1): this function is new. Nothing previously
 * performed this transition, so every admin-created auction was
 * permanently stuck at UPCOMING once `startTime` passed. Called from the
 * same three places `closeExpiredAuctions`/`ensureAuctionFinalized`
 * already were (the cron route, the public auctions list, and the
 * auction detail page), mirroring the existing lazy-finalization
 * architecture rather than introducing a new one.
 */
export async function activateDueAuctions(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Auction"
    SET status = 'ACTIVE'
    WHERE status = 'UPCOMING'
      AND now() >= "startTime"
      AND now() < "endTime"
  `;
}

/**
 * Lazy-finalization helper for Server Components: called before rendering
 * an auction (list or detail) so a page view never shows a "Live" auction
 * whose clock has actually already run out. Cheap no-op when nothing is
 * due — the caller re-fetches fresh data afterward either way.
 */
export async function ensureAuctionFinalized(auction: {
  id: string;
  status: AuctionStatus;
  endTime: Date;
}): Promise<void> {
  if ((auction.status === "ACTIVE" || auction.status === "UPCOMING") && auction.endTime.getTime() <= Date.now()) {
    await finalizeAuction(auction.id);
  }
}

/**
 * Lazy-activation counterpart to `ensureAuctionFinalized`, for the same
 * per-page-load call sites. Companion function rather than folding into
 * `ensureAuctionFinalized` itself, so each stays a single-purpose,
 * single-guard check — same reasoning as keeping `activateDueAuctions`
 * and `closeExpiredAuctions` separate above.
 */
export async function ensureAuctionActivated(auction: {
  id: string;
  status: AuctionStatus;
  startTime: Date;
  endTime: Date;
}): Promise<void> {
  if (auction.status === "UPCOMING" && auction.startTime.getTime() <= Date.now() && auction.endTime.getTime() > Date.now()) {
    await prisma.$executeRaw`
      UPDATE "Auction" SET status = 'ACTIVE' WHERE id = ${auction.id} AND status = 'UPCOMING'
    `;
  }
}
