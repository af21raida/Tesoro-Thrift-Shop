import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionForm } from "@/components/auctions/auction-form";

/**
 * Phase 12 addition: createAuctionAction has accepted BUYER_SELLER since
 * the Phase 12 role merge (see actions/auction/create-auction.ts), but no
 * page ever rendered AuctionForm for anyone but ADMIN — a BUYER_SELLER had
 * the write path but no way to reach it. This is now the only
 * new-auction page (the former admin counterpart at
 * app/(admin)/admin/auctions/new was removed along with admin's ability to
 * create auctions); submitting here lands on /seller/auctions/[id]/edit —
 * see create-auction.ts's redirect.
 *
 * Not explicitly requested in the "My Auctions" ask, but added alongside
 * it: without an entry point, "My Auctions" would have no auctions to ever
 * show for a BUYER_SELLER. Flagged in the accompanying summary.
 */
export default async function NewSellerAuctionPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect("/login?redirectTo=/seller/auctions/new");
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Auctions</span>
      <h1 className="mt-2 text-2xl">Create an auction</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Creates a new limited-edition item and its auction together — there&apos;s no separate step to make an
        existing product auctionable.
      </p>
      <div className="mt-6">
        <AuctionForm categories={categories} submitLabel="Create auction" />
      </div>
    </div>
  );
}
