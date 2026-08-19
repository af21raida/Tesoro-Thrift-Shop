import "server-only";
import { Prisma, type Bid } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/format/currency";

export class AuctionNotFoundError extends Error {
  constructor() {
    super("This auction no longer exists.");
    this.name = "AuctionNotFoundError";
  }
}

export class AuctionNotStartedError extends Error {
  constructor() {
    super("This auction hasn't started yet.");
    this.name = "AuctionNotStartedError";
  }
}

export class AuctionEndedError extends Error {
  constructor() {
    super("This auction has already ended.");
    this.name = "AuctionEndedError";
  }
}

export class AuctionCancelledError extends Error {
  constructor() {
    super("This auction was cancelled.");
    this.name = "AuctionCancelledError";
  }
}

export class BidTooLowError extends Error {
  constructor(public readonly floorAmount: string) {
    super(`Your bid must be higher than ${formatCurrency(floorAmount)}.`);
    this.name = "BidTooLowError";
  }
}

export interface PlaceBidInput {
  auctionId: string;
  userId: string;
  amount: string;
}

/**
 * Places a bid using the same "guard lives in the WHERE clause of the
 * write itself" pattern lib/inventory/stock.ts already uses for
 * decrementStock — one atomic statement instead of a read-then-write.
 *
 * BID RULE: the auction's `startingPrice` is an absolute floor — the
 * very first bid may meet it exactly (amount >= startingPrice). Once a
 * bid exists, the floor becomes the current highest bid, and the next
 * bid must be strictly higher than that — by any amount, even one cent.
 * There is no mandatory minimum increment: `minIncrement` is NOT part of
 * this comparison (the column may still exist on the Auction model for
 * other purposes, but bid validation no longer reads it). So:
 *
 *   no bid yet:  amount >= startingPrice
 *   bid exists:  amount > currentHighestBid
 *
 * Frontend (BidForm's `minimumNextBid`, computed on the auction detail
 * page) and backend (this guard, and `BidTooLowError`'s message below)
 * both derive the floor the same way so neither can contradict the
 * other.
 *
 * WHY THIS IS SAFE UNDER CONCURRENT BIDS (test 10 in the Phase 8 brief):
 * A naive implementation — SELECT the current highest bid, compare it to
 * the incoming amount in application code, then INSERT — has a race: two
 * requests can both read the same "current highest" before either writes,
 * both decide their bid clears it, and both get accepted even if one of
 * them should have been rejected against the other's (not-yet-committed)
 * bid. Postgres closes that gap for a single UPDATE...WHERE statement
 * because the UPDATE takes a row-level lock on the matched Auction row as
 * part of evaluating and applying itself: two concurrent bids on the SAME
 * auction serialize on that lock — the second one physically waits for
 * the first to commit, and only then evaluates its own WHERE clause,
 * which by then sees the first bid's already-committed
 * `currentHighestBid`. There is no window where both statements are
 * comparing against a stale value. Bids on two *different* auctions never
 * block each other, since they lock different rows.
 *
 * The actual `Bid` row is created in the same `$transaction` right after
 * the guarded UPDATE succeeds, so a failure inserting the Bid rolls back
 * the `currentHighestBid` change too — the two can never disagree.
 *
 * TIMEZONE NOTE: `now` below is passed to the SQL guard as a UTC ISO
 * string cast to `timestamp` (`::timestamp`), NOT as a JS Date. The
 * startTime/endTime columns are `timestamp` (no time zone) and Prisma
 * writes/reads every DateTime in this app as UTC wall-clock, so the guard
 * must compare UTC wall-clock to UTC wall-clock. Passing a JS Date sends a
 * `timestamptz`; comparing that against a `timestamp` column makes
 * Postgres convert the column using the *database session's* timezone —
 * on a non-UTC session (e.g. Asia/Dhaka) that shifts the comparison by the
 * offset and a freshly-open auction can fail the time guard. A UTC ISO
 * string with an explicit `::timestamp` cast compares wall-clock to
 * wall-clock and agrees with the JS-side checks below on any session
 * timezone.
 */
export async function placeBid(input: PlaceBidInput): Promise<Bid> {
  const amount = new Prisma.Decimal(input.amount);
  // Bound in as a UTC ISO string cast to `timestamp`, never as a raw JS
  // Date — see the TIMEZONE NOTE above the function. `now` stays a Date
  // for the JS-side diagnostic checks below.
  const now = new Date();
  const nowUtc = now.toISOString();

  return prisma.$transaction(async (tx) => {
    const affected = await tx.$executeRaw`
      UPDATE "Auction"
      SET "currentHighestBid" = ${amount}
      WHERE id = ${input.auctionId}
        AND status = 'ACTIVE'
        AND ${nowUtc}::timestamp >= "startTime"
        AND ${nowUtc}::timestamp < "endTime"
        AND (
          ("currentHighestBid" IS NULL AND ${amount} >= "startingPrice")
          OR
          ("currentHighestBid" IS NOT NULL AND ${amount} > "currentHighestBid")
        )
    `;

    if (affected === 0) {
      // The guarded UPDATE matched zero rows — figure out *why*, for a
      // useful error message. This second read is purely for the message;
      // it plays no role in the accept/reject decision above, which the
      // database already made atomically.
      const auction = await tx.auction.findUnique({ where: { id: input.auctionId } });
      if (!auction) throw new AuctionNotFoundError();
      if (auction.status === "CANCELLED") throw new AuctionCancelledError();
      if (auction.status === "PENDING") throw new AuctionNotStartedError();

      if (auction.status === "ENDED" || now >= auction.endTime) throw new AuctionEndedError();
      if (auction.status === "UPCOMING" || now < auction.startTime) throw new AuctionNotStartedError();

      const floor = auction.currentHighestBid ?? auction.startingPrice;
      throw new BidTooLowError(floor.toFixed(2));
    }

    return tx.bid.create({
      data: { auctionId: input.auctionId, userId: input.userId, amount },
    });
  });
}
