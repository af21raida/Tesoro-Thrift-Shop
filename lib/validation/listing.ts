import { z } from "zod";
import { PRODUCT_CONDITIONS, decimalString, intString } from "./product";

/**
 * Phase 12 fix: a seller listing now carries real stock, same as
 * THRIFT_STOCK — see create-listing.ts's docstring for why this replaced
 * the old "always exactly one, sold via Listing.status" model rather than
 * sitting alongside it as a second stock system. `min: 1` because a
 * listing represents at least one physical item for sale; 0 isn't a
 * meaningful starting quantity for something being listed right now (an
 * existing listing can later be adjusted down to 0 through the normal
 * stock/checkout decrement path, same as any THRIFT_STOCK item selling
 * out).
 */
export const listingSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters.")
    .max(800, "Keep the description under 800 characters."),
  price: decimalString,
  condition: z.enum(PRODUCT_CONDITIONS, {
    errorMap: () => ({ message: "Select a condition." }),
  }),
  categoryId: z.string().trim().min(1, "Select a category."),
  // Images are handled outside this schema — see the note in
  // lib/validation/product.ts above productSchema.
  quantity: intString("Quantity", { min: 1 }),
});

export type ListingInput = z.infer<typeof listingSchema>;

// Admins must give sellers a reason when rejecting a listing — an empty or
// one-word rejection isn't actionable feedback for a resubmission.
export const rejectListingSchema = z.object({
  reason: z.string().trim().min(3, "Give the seller a short reason.").max(500),
});

export type RejectListingInput = z.infer<typeof rejectListingSchema>;
