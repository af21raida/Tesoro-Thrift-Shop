import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ListingStatusBadge } from "@/components/listings/listing-status-badge";
import { DeleteListingButton } from "@/components/listings/delete-listing-button";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function SellerListingsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect("/login?redirectTo=/seller/listings");
  }

  const listings = await prisma.listing.findMany({
    where: { sellerId: user.id },
    include: { product: { include: { category: true, inventory: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="tag-badge text-ink-soft">Listings</span>
          <h1 className="mt-2 text-2xl">My listings</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything you&apos;ve submitted to the marketplace, and its current review status.
          </p>
        </div>
        <Link
          href="/seller/listings/create"
          className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          + New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          You haven&apos;t listed anything yet. Create your first listing to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Listed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/products/${listing.productId}`} className="hover:underline">
                      {listing.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{listing.product.category.name}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(listing.product.price.toString())}</td>
                  <td className="px-4 py-3 font-mono">{listing.product.inventory?.stock ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {listing.product.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <ListingStatusBadge status={listing.status} />
                    {listing.status === "REJECTED" && listing.rejectionReason && (
                      <p className="mt-1 max-w-xs text-xs text-ink-soft">Reason: {listing.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {(listing.status === "PENDING" ||
                        listing.status === "REJECTED" ||
                        listing.status === "APPROVED" ||
                        listing.status === "ACTIVE") && (
                        <Link
                          href={`/seller/listings/${listing.id}/edit`}
                          className="rounded-tag border border-ink px-3 py-1.5 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
                        >
                          Edit
                        </Link>
                      )}
                      {listing.status !== "SOLD" && (
                        <DeleteListingButton listingId={listing.id} listingName={listing.product.name} />
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
