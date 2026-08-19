import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { ConditionBadge } from "@/components/products/condition-badge";
import { StockBadge } from "@/components/inventory/stock-badge";
import { ListingStatusBadge } from "@/components/listings/listing-status-badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { canShop } from "@/lib/auth/rbac";
import { formatCurrency } from "@/lib/format/currency";

interface PageProps {
  params: { id: string };
}

export default async function ProductDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { category: true, inventory: true, listing: true, auction: true },
  });

  if (!product) notFound();

  // Session is needed below the old visibility check too now (to decide
  // whether to show "add to cart" vs. a login prompt, and to block a
  // seller from buying their own listing), so it's fetched once up top
  // rather than only inside the visibility branch as before.
  const session = await getSession();

  // Unapproved listings are never publicly visible (Phase 6 requirement) —
  // enforced here as a second gate on top of the query-level filter in
  // lib/listings/visibility.ts, since this page is reached directly by ID
  // rather than only through the filtered browse/category queries. The one
  // exception is the listing's own seller and admins, who need to be able
  // to open it to review, edit, or resubmit it.
  const listing = product.listing;
  if (listing && listing.status !== "APPROVED" && listing.status !== "ACTIVE") {
    const canView = Boolean(session && (session.userId === listing.sellerId || session.roles.includes("ADMIN")));
    if (!canView) notFound();
  }

  // Auction items are public only while their auction is UPCOMING or ACTIVE
  // (the same rule the catalog query in lib/listings/visibility.ts
  // enforces). This page is reachable directly by product ID, so an
  // expired/cancelled/pending auction item gets the same second gate the
  // listing branch above has: hidden from everyone except the auction's own
  // owner and admins, who still manage these records on /admin/auctions.
  const auction = product.auction;
  if (auction && auction.status !== "UPCOMING" && auction.status !== "ACTIVE") {
    const canView = Boolean(session && (session.userId === auction.createdById || session.roles.includes("ADMIN")));
    if (!canView) notFound();
  }

  // Phase 6 left this at `type === "THRIFT_STOCK"` only, with a note that
  // cart/checkout for marketplace listings would land in Phase 7. The
  // Phase 2 schema was built for both from the start — `OrderItem.listingId`
  // is nullable specifically so one order item can originate from either a
  // plain stocked product or a seller's listing — so this is Phase 7
  // catching the page up to what the data model already supported, not a
  // new decision: an APPROVED/ACTIVE listing is exactly as purchasable as a
  // THRIFT_STOCK product now that checkout logic (actions/checkout/checkout.ts)
  // exists to handle both.
  const isThriftStock = product.type === "THRIFT_STOCK";
  // Phase 12 fix: also requires real stock now (previously `listing.status`
  // alone was the entire "is this purchasable" signal — see
  // checkout.ts's docstring on why a listing's status and its stock are
  // now two independent checks rather than one conflated one).
  const isPurchasableListing =
    product.type === "USER_LISTING" &&
    listing !== null &&
    (listing.status === "APPROVED" || listing.status === "ACTIVE") &&
    Boolean(product.inventory?.available) &&
    (product.inventory?.stock ?? 0) > 0;
  const isOwnListing = listing !== null && session !== null && session.userId === listing.sellerId;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <Link href={`/categories/${product.category.slug}`} className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
        {product.category.name}
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14">
        <div className="grid grid-cols-2 gap-2">
          {product.images.length > 0 ? (
            product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured hosts; see next.config.mjs note
              <img
                key={image}
                src={image}
                alt={product.name}
                className="aspect-square w-full rounded-tag border border-line object-cover"
              />
            ))
          ) : (
            <div className="col-span-2 flex aspect-square items-center justify-center rounded-tag border border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-3xl">{product.name}</h1>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-semibold text-ink">{formatCurrency(product.price)}</span>
            <ConditionBadge condition={product.condition} />
            {listing && <ListingStatusBadge status={listing.status} />}
          </div>

          {product.inventory && (
            <StockBadge
              stock={product.inventory.stock}
              lowStockThreshold={product.inventory.lowStockThreshold}
              available={product.inventory.available}
            />
          )}

          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{product.description}</p>

          {listing && listing.status !== "APPROVED" && listing.status !== "ACTIVE" && (
            <p className="rounded-tag border border-brass bg-brass/5 px-3 py-2 text-xs text-brass-dark">
              Only visible to you because this listing is {listing.status.toLowerCase()} — it isn&apos;t shown in the
              public marketplace yet.
            </p>
          )}

          {isThriftStock &&
            (product.inventory?.available && product.inventory.stock > 0 ? (
              session && canShop(session) ? (
                <AddToCartButton productId={product.id} maxQuantity={product.inventory.stock} />
              ) : session ? (
                <p className="text-xs text-ink-soft">Admin and staff accounts can&apos;t add items to a cart.</p>
              ) : (
                <p className="text-xs text-ink-soft">
                  <Link href="/login" className="underline hover:text-ink">
                    Log in
                  </Link>{" "}
                  to add this to your cart.
                </p>
              )
            ) : (
              <p className="text-xs text-ink-soft">Currently unavailable.</p>
            ))}

          {product.type === "USER_LISTING" &&
            (isPurchasableListing ? (
              isOwnListing ? (
                <p className="text-xs text-ink-soft">This is your own listing.</p>
              ) : session && canShop(session) ? (
                <AddToCartButton productId={product.id} maxQuantity={product.inventory?.stock} />
              ) : session ? (
                <p className="text-xs text-ink-soft">Admin and staff accounts can&apos;t add items to a cart.</p>
              ) : (
                <p className="text-xs text-ink-soft">
                  <Link href="/login" className="underline hover:text-ink">
                    Log in
                  </Link>{" "}
                  to add this to your cart.
                </p>
              )
            ) : (
              <p className="text-xs text-ink-soft">Not currently purchasable.</p>
            ))}

          {product.type === "AUCTION_ITEM" && product.auction && (
            <Link
              href={`/auctions/${product.auction.id}`}
              className="inline-block w-fit rounded-tag border border-plum px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-plum hover:bg-plum hover:text-paper"
            >
              This is an auction item — view auction &amp; place a bid →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
