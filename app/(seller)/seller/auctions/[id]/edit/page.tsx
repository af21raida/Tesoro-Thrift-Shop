import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuctionEditForm } from "@/components/auctions/auction-edit-form";

interface PageProps {
  params: { id: string };
}

/** Same "2026-08-20T18:30" local-input shape as the admin edit page — see
 * that page's copy of this helper and lib/validation/auction.ts's note on
 * why server-local time is the right zone here. Duplicated rather than
 * extracted to a shared module to keep this page a drop-in mirror of the
 * admin one with no shared-module churn to the existing architecture. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Phase 12 fix: the BUYER_SELLER-facing counterpart to
 * app/(admin)/admin/auctions/[id]/edit — update-auction.ts has accepted
 * owner-or-admin since the Phase 12 role merge, but only the admin page
 * called it. This page submits to the exact same action and reuses the
 * exact same AuctionEditForm; the only difference is the guard below,
 * which checks *ownership* instead of the ADMIN role, and 404s (rather
 * than redirecting to login) when the auction belongs to someone else —
 * same "don't reveal whether the ID exists to a non-owner" convention as
 * app/(seller)/seller/listings/[id]/edit.
 *
 * Ownership and the UPCOMING/zero-bids eligibility window are both
 * re-checked inside updateAuctionAction on submit too — this page's checks
 * are what keep another seller (or a stale link to a since-started
 * auction) from even loading the form.
 */
export default async function SellerEditAuctionPage({ params }: PageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect(`/login?redirectTo=/seller/auctions/${params.id}/edit`);
  }

  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    include: { product: true, _count: { select: { bids: true } } },
  });
  if (!auction) notFound();
  // Ownership only — unlike the admin edit page, ADMIN does not get an
  // override here. An admin managing someone else's auction uses
  // /admin/auctions/[id]/edit instead, which is exactly what that page
  // remains for.
  if (auction.createdById !== user.id) notFound();

    // PENDING (awaiting admin approval) is editable alongside UPCOMING —
  // same window update-auction.ts enforces on submit.
  const editable = (auction.status === "UPCOMING" || auction.status === "PENDING") && auction._count.bids === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Auctions</span>
      <h1 className="mt-2 text-2xl">{auction.product.name}</h1>

      {!editable ? (
        <p className="mt-4 rounded-tag border border-brass bg-brass/5 px-3 py-2 text-xs text-brass-dark">
          This auction can no longer be edited — it has{" "}
          {auction._count.bids > 0 ? "at least one bid" : "already started"}.
        </p>
      ) : (
        <div className="mt-6">
          <AuctionEditForm
            auctionId={auction.id}
            defaultValues={{
              startingPrice: auction.startingPrice.toString(),
              minIncrement: auction.minIncrement.toString(),
              startTime: toLocalInputValue(auction.startTime),
              endTime: toLocalInputValue(auction.endTime),
            }}
          />
        </div>
      )}
    </div>
  );
}
