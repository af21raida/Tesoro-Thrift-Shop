import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * `THRIFT_STOCK` products have no moderation gate of their own — Admin adds
 * store stock directly. `USER_LISTING` products must never be shown to the
 * public until their `Listing` has cleared admin review. `AUCTION_ITEM`
 * products appear in the shopping catalog only while their auction is
 * UPCOMING or ACTIVE — the same two statuses the public feed shows — so an
 * expired (ENDED), cancelled, or still-pending auction item drops out of
 * browse/search/category/homepage results while its auction record remains
 * fully visible to admins on /admin/auctions (and as history on the
 * auction's own detail page).
 *
 * This is deliberately a query-level filter (not just something the UI
 * chooses not to link to) — it's the actual enforcement for "unapproved
 * listings are not publicly visible" and "expired auction items aren't
 * shown while shopping," applied everywhere the public catalog is queried
 * (browse, category pages, homepage recent listings). The product detail
 * page additionally carves out exceptions for a listing's own seller, an
 * auction's own owner, and admins, who need to be able to open a
 * pending/rejected/expired item to review or manage it — see
 * app/(public)/products/[id]/page.tsx.
 */
export const PUBLICLY_VISIBLE_PRODUCT: Prisma.ProductWhereInput = {
  OR: [
    { type: "THRIFT_STOCK" },
    { type: "AUCTION_ITEM", auction: { status: { in: ["UPCOMING", "ACTIVE"] } } },
    { type: "USER_LISTING", listing: { status: { in: ["APPROVED", "ACTIVE"] } } },
  ],
};
