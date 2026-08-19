import { z } from "zod";
import { PRODUCT_CONDITIONS, decimalString } from "./product";

/**
 * `<input type="datetime-local">` posts a value like "2026-08-20T18:30"
 * (no seconds, no timezone). Zod only validates the shape here; `new
 * Date(...)` parses it in the *server's* local timezone, which matches
 * what the admin's browser displayed since both run the same offset in
 * this project's deployment (no per-user timezone preference exists).
 */
const datetimeString = z
  .string()
  .trim()
  .min(1, "Required.")
  .refine((val) => !Number.isNaN(new Date(val).getTime()), "Enter a valid date and time.");

/**
 * Creates the AUCTION_ITEM `Product` and its `Auction` row together (see
 * actions/auction/create-auction.ts) — there's no separate "mark an
 * existing product eligible for auction" flow, so this is deliberately a
 * superset of productSchema's catalog fields (minus stock/availability,
 * which THRIFT_STOCK-only Inventory owns) plus the auction-specific
 * timing/pricing fields.
 */
/**
 * How far into the past a submitted `startTime` may fall before it's
 * rejected. Not zero: the value is read from the form, sent over the
 * network, and validated a moment later, so a strict `> Date.now()` check
 * would flake on an admin who picked "now" and had the request take a
 * couple of seconds. Generous enough to absorb that latency, tight enough
 * that it still catches the actual bug (Phase 11 audit issue #3/#1: an
 * admin picking a start time that's already minutes/hours/days in the
 * past, which combined with the UPCOMING->ACTIVE fix in
 * lib/auction/closing.ts would otherwise activate on the very next sweep
 * instead of ever showing as a real "upcoming" auction).
 */
const START_TIME_PAST_SKEW_MS = 60_000;

export const createAuctionSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters.")
      .max(800, "Keep the description under 800 characters."),
    condition: z.enum(PRODUCT_CONDITIONS, {
      errorMap: () => ({ message: "Select a condition." }),
    }),
    categoryId: z.string().trim().min(1, "Select a category."),
    // Images are handled outside this schema — see the note in
    // lib/validation/product.ts above productSchema.
    startingPrice: decimalString,
    minIncrement: decimalString,
    startTime: datetimeString,
    endTime: datetimeString,
  })
  .refine((data) => new Date(data.startTime).getTime() > Date.now() - START_TIME_PAST_SKEW_MS, {
    message: "Start time must be in the future.",
    path: ["startTime"],
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

/**
 * Only the terms an UPCOMING, zero-bid auction may still change (see
 * actions/auction/update-auction.ts) — name/description/images/category
 * belong to the Product and are not editable here since nothing in any
 * diagram defines a "re-list an auction item" use case.
 */
export const updateAuctionSchema = z
  .object({
    startingPrice: decimalString,
    minIncrement: decimalString,
    startTime: datetimeString,
    endTime: datetimeString,
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;

export const placeBidSchema = z.object({
  auctionId: z.string().trim().min(1),
  amount: decimalString,
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
