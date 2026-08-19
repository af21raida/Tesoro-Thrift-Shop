import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ListingForm } from "@/components/listings/listing-form";
import { updateListingAction } from "@/actions/listings/update-listing";

interface PageProps {
  params: { id: string };
}

export default async function EditListingPage({ params }: PageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect(`/login?redirectTo=/seller/listings/${params.id}/edit`);
  }

  const [listing, categories] = await Promise.all([
    prisma.listing.findUnique({ where: { id: params.id }, include: { product: { include: { inventory: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!listing) notFound();
  // Ownership is re-checked inside updateListingAction on submit too — this
  // is just what keeps another seller from even loading the form.
  if (listing.sellerId !== user.id) notFound();

  if (
    listing.status !== "PENDING" &&
    listing.status !== "REJECTED" &&
    listing.status !== "APPROVED" &&
    listing.status !== "ACTIVE"
  ) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="rounded-tag border border-stamp bg-stamp/5 px-6 py-8 text-center text-sm text-stamp">
          This listing is {listing.status.toLowerCase()} and can no longer be edited. Remove it and create a new
          listing if you need to change it.
        </p>
      </div>
    );
  }

  const boundAction = updateListingAction.bind(null, listing.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Listings</span>
      <h1 className="mt-2 text-2xl">Edit listing</h1>
      {listing.status === "REJECTED" && (
        <p className="mt-1 text-sm text-ink-soft">
          Saving changes resubmits this listing for review.
          {listing.rejectionReason ? ` Previous reason: ${listing.rejectionReason}` : ""}
        </p>
      )}
      {(listing.status === "APPROVED" || listing.status === "ACTIVE") && (
        <p className="mt-1 text-sm text-ink-soft">
          This listing is live. Saving changes resubmits it for admin review before it goes live again.
        </p>
      )}

      <div className="mt-6">
        <ListingForm
          action={boundAction}
          categories={categories}
          submitLabel="Save changes"
          defaultValues={{
            name: listing.product.name,
            description: listing.product.description,
            price: listing.product.price.toString(),
            condition: listing.product.condition,
            categoryId: listing.product.categoryId,
            images: listing.product.images,
            // Falls back to "1" for a listing created before Phase 12's
            // Inventory backfill (see update-listing.ts's upsert) —
            // matches the same "at least one item" floor the form/schema
            // otherwise enforces.
            quantity: String(listing.product.inventory?.stock ?? 1),
          }}
        />
      </div>
    </div>
  );
}
