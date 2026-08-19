import Link from "next/link";
import { redirect } from "next/navigation";
import type { ListingStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ListingStatusBadge } from "@/components/listings/listing-status-badge";
import { ApproveListingButton } from "@/components/listings/approve-listing-button";
import { RejectListingForm } from "@/components/listings/reject-listing-form";
import { RemoveListingButton } from "@/components/listings/remove-listing-button";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: ListingStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Sold", value: "SOLD" },
  { label: "Removed", value: "REMOVED" },
  { label: "All", value: "ALL" },
];

interface PageProps {
  searchParams: { status?: string };
}

export default async function AdminListingsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /admin/* to
  // ADMIN, but this page checks for itself too — same convention as every
  // other role-gated page since Phase 4.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/listings");
  }

  const requested = searchParams.status?.toUpperCase();
  const activeStatus: ListingStatus | "ALL" =
    requested && FILTERS.some((filter) => filter.value === requested) ? (requested as ListingStatus | "ALL") : "PENDING";

  const listings = await prisma.listing.findMany({
    where: activeStatus === "ALL" ? {} : { status: activeStatus },
    include: { product: { include: { category: true } }, seller: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Listings</span>
      <h1 className="mt-2 text-2xl">Moderate listings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Review seller submissions, approve or reject them, or remove something already live.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/listings?status=${filter.value}`}
            className={`rounded-tag border px-3 py-1.5 font-display font-semibold text-xs uppercase tracking-wide ${
              activeStatus === filter.value ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <p className="mt-6 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No listings in this view.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/products/${listing.productId}`} className="hover:underline">
                      {listing.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {listing.seller.name}
                    <br />
                    <span className="text-xs">{listing.seller.email}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{listing.product.category.name}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(listing.product.price.toString())}</td>
                  <td className="px-4 py-3">
                    <ListingStatusBadge status={listing.status} />
                    {listing.status === "REJECTED" && listing.rejectionReason && (
                      <p className="mt-1 max-w-xs text-xs text-ink-soft">Reason: {listing.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      {listing.status === "PENDING" && (
                        <div className="flex gap-2">
                          <ApproveListingButton listingId={listing.id} />
                          <RejectListingForm listingId={listing.id} />
                        </div>
                      )}
                      {listing.status !== "REMOVED" && listing.status !== "PENDING" && (
                        <RemoveListingButton listingId={listing.id} listingName={listing.product.name} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
