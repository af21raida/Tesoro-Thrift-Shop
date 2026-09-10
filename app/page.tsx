import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PUBLICLY_VISIBLE_PRODUCT } from "@/lib/listings/visibility";
import { ProductGrid } from "@/components/products/product-grid";
import { AuctionCard } from "@/components/auctions/auction-card";
import { HomeSearchBar } from "@/components/layout/home-search-bar";
import { activateDueAuctions, closeExpiredAuctions } from "@/lib/auction/closing";

export const dynamic = "force-dynamic";

/**
 * Homepage "Auction Items" section. Reuses the same query shape and
 * AuctionCard component as /auctions (no second auction system) — just
 * capped to a handful of cards for the homepage instead of the full list.
 * ENDED auctions are excluded by the `status: in [...]` filter; they stay
 * in the database and remain visible on the auction's own detail page and
 * in auction history, just not here.
 */
async function AuctionItems(): Promise<React.JSX.Element | null> {
  await activateDueAuctions();
  await closeExpiredAuctions();

  const auctions = await prisma.auction.findMany({
    where: { status: { in: ["UPCOMING", "ACTIVE"] } },
    include: { product: true, _count: { select: { bids: true } } },
    orderBy: [{ status: "asc" }, { endTime: "asc" }],
    take: 4,
  });

  if (auctions.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <span className="tag-badge text-plum">Now &amp; next</span>
          <h2 className="mt-2 text-2xl">Auction items</h2>
        </div>
        <Link href="/auctions" className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
          View all auctions &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={{
              id: auction.id,
              status: auction.status,
              startTime: auction.startTime.toISOString(),
              endTime: auction.endTime.toISOString(),
              startingPrice: auction.startingPrice.toString(),
              currentHighestBid: auction.currentHighestBid?.toString() ?? null,
              bidCount: auction._count.bids,
              product: {
                name: auction.product.name,
                images: auction.product.images,
                condition: auction.product.condition,
              },
            }}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Section 3 (homepage): recent listings, sorted by newest first, shown to
 * every visitor (logged in or not) — same as the /products browse page.
 * Reuses `Product.createdAt` for "when was this listed" rather than adding
 * a new column — every product (store stock, a seller's listing, an
 * auction item) already gets a `createdAt` the moment it's created, which
 * is exactly "when it was listed" for all three cases; a separate
 * `listedAt` field would just be a second copy of the same timestamp; a
 * copy the client could send a value for. Same `PUBLICLY_VISIBLE_PRODUCT`
 * filter the /products browse page uses, so an unapproved listing never
 * shows up here either.
 *
 * Deliberately read-only: a ProductCard only ever links to the product's
 * detail page — it has no buy/bid button embedded — so this same query
 * and grid is safe to show to ADMIN, STAFF, and BUYER_SELLER alike
 * without leaking a purchasing or bidding control to a role that
 * shouldn't have one. The actual buy/bid actions stay gated where they
 * always were: the detail pages and their Server Actions (see
 * actions/cart/cart-actions.ts, actions/auction/place-bid.ts).
 */
async function RecentListings(): Promise<React.JSX.Element> {
  const products = await prisma.product.findMany({
    where: {
      AND: [
        PUBLICLY_VISIBLE_PRODUCT,
        // Fix: zero-stock products stay in the database (Admin/Staff still
        // manage them from inventory pages) but shouldn't surface on the
        // public homepage. AUCTION_ITEM products have no Inventory row at
        // all — their availability is governed by the auction, not stock —
        // so they're left alone by this filter (inventory: null passes).
        { OR: [{ inventory: null }, { inventory: { stock: { gt: 0 } } }] },
      ],
    },
    include: {
      category: true,
      inventory: true,
      listing: { include: { seller: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <span className="tag-badge text-ink-soft">New arrivals</span>
          <h2 className="mt-2 text-2xl">Recently listed</h2>
        </div>
        <Link href="/products" className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
          Browse all &rarr;
        </Link>
      </div>

      <ProductGrid
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price.toString(),
          condition: product.condition,
          images: product.images,
          category: { name: product.category.name, slug: product.category.slug },
          inventory: product.inventory
            ? {
                stock: product.inventory.stock,
                lowStockThreshold: product.inventory.lowStockThreshold,
                available: product.inventory.available,
              }
            : null,
          sellerName: product.listing?.seller.name ?? null,
          listedAt: product.createdAt.toISOString(),
        }))}
      />
    </section>
  );
}

/**
 * Homepage categories strip. Same categories the /categories page already
 * lists — no duplicate taxonomy — just capped to a row for the homepage.
 */
async function Categories(): Promise<React.JSX.Element | null> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
    take: 8,
  });

  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6">
        <span className="tag-badge text-ink-soft">Browse by</span>
        <h2 className="mt-2 text-2xl">Categories</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="flex flex-col gap-1 rounded-tag border border-line bg-paper-dim px-4 py-4 hover:border-ink"
          >
            <span className="font-display text-base text-ink">{category.name}</span>
            <span className="font-mono text-[11px] text-ink-soft">
              {category._count.products} item{category._count.products === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Hero card → product mapping. Each of the four hero cutouts links to its
 * real product-detail page (`/products/[id]`), resolved by exact product
 * name at render time so a reseed (new IDs, same names) can't break the
 * links. Falls back to the /products browse page if an item is ever
 * missing — never a dead link, never a duplicate product, no hardcoded
 * product info beyond the names used for the lookup.
 */
const HERO_PRODUCT_NAMES = {
  cd: '"the Queen Is Dead"- cd By The Smiths',
  poster: "The Holdovers Poster",
  book: "Homesick For Another World By Ottessa Moshfegh",
  tee: "Cat White Tee",
} as const;

export default async function HomePage(): Promise<React.JSX.Element> {
  // Session is only needed to point the "Sell an item" CTA at /seller vs.
  // /register — every section on this page is otherwise public.
  const session = await getSession();

  const heroProducts = await prisma.product.findMany({
    where: { name: { in: Object.values(HERO_PRODUCT_NAMES) } },
    select: { id: true, name: true },
  });
  const heroHref = (name: string): string => {
    const found = heroProducts.find((product) => product.name === name);
    return found ? `/products/${found.id}` : "/products";
  };

  return (
    <div>
      <HomeSearchBar />
      <div className="mx-auto max-w-6xl px-6">
        <section className="grid gap-10 py-16 md:grid-cols-[1fr_1.15fr] md:py-24">
          <div className="flex flex-col justify-center gap-6">
            <h1 className="max-w-lg font-display text-4xl italic leading-[1.05] text-ink md:text-6xl">
              Find treasures.
              <br />
              <span className="not-italic text-teal">Give them a new story.</span>
            </h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-tag bg-teal px-5 py-2.5 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-teal-light"
              >
                Browse the shop
              </Link>
              <Link
                href="/auctions"
                className="rounded-tag border border-plum px-5 py-2.5 font-display font-semibold text-xs uppercase tracking-wide text-plum hover:bg-plum hover:text-paper"
              >
                See live auctions
              </Link>
            </div>
          </div>

          {/* Hero-side collage — the four product cutouts (transparent
              backgrounds, no card boxes) arranged like the reference:
              CD back-left, poster centre, book right, tee front-bottom.
              Each cutout is a link to its real product-detail page; each
              still shifts sideways on its own hover via .hero-card:hover
              (see app/globals.css) while the other cutouts never move. */}
          <div className="flex items-center justify-center self-center">
            <div className="hero-spread">
              <Link
                href={heroHref(HERO_PRODUCT_NAMES.cd)}
                className="hero-card hero-card-1"
                aria-label={HERO_PRODUCT_NAMES.cd}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local hero assets */}
                <img src="/hero-card-cd.png" alt="" width={600} height={600} />
              </Link>
              <Link
                href={heroHref(HERO_PRODUCT_NAMES.poster)}
                className="hero-card hero-card-2"
                aria-label={HERO_PRODUCT_NAMES.poster}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local hero assets */}
                <img src="/hero-card-poster.png" alt="" width={600} height={800} />
              </Link>
              <Link
                href={heroHref(HERO_PRODUCT_NAMES.book)}
                className="hero-card hero-card-3"
                aria-label={HERO_PRODUCT_NAMES.book}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local hero assets */}
                <img src="/hero-card-book.png" alt="" width={600} height={800} />
              </Link>
              <Link
                href={heroHref(HERO_PRODUCT_NAMES.tee)}
                className="hero-card hero-card-4"
                aria-label={HERO_PRODUCT_NAMES.tee}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local hero assets */}
                <img src="/hero-card-tee.png" alt="" width={600} height={700} />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <AuctionItems />

      <Categories />
      <RecentListings />

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl">Have something worth selling?</h2>
            <p className="mt-2 max-w-md text-base text-ink-soft">
              List a fixed-price item or start an auction — set your own price, condition, and terms.
            </p>
          </div>
          <Link
            href={session ? "/seller" : "/register"}
            className="rounded-tag bg-teal px-5 py-2.5 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-teal-light"
          >
            Sell an item
          </Link>
        </div>
      </section>

      <section className="border-t border-brass-dark/50 bg-burgundy">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
          <div className="overflow-hidden rounded-tag border border-brass/60 bg-paper shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- local logo asset */}
            <img
              src="/tesoro-logo.png"
              alt="Tesoro logo"
              width={913}
              height={911}
              className="h-auto w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-5">
            <span className="tag-badge w-fit border-brass-light text-brass-light">Our story</span>
            <h2 className="text-3xl text-paper">Every item has a story</h2>
            <div className="ornament max-w-sm" aria-hidden>
              <span className="h-2 w-2 rotate-45 border border-brass-light" />
            </div>
            <p className="text-base leading-relaxed text-paper/75">
              Secondhand shopping means fewer things end up in landfill and more things get a second
              chapter. Every piece on Tesoro was chosen, used, and loved by someone before you — a coat
              that's been somewhere, a record that's been played, a vase that's held someone else's
              flowers. Buying it here keeps that story going instead of starting a new one from scratch.
            </p>
            <p className="text-base leading-relaxed text-paper/75">
              Our auctions work the same way, just for the pieces that are one of one — the kind of find
              worth a bit of friendly competition.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
