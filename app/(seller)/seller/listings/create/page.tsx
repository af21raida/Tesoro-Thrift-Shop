import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ListingForm } from "@/components/listings/listing-form";
import { createListingAction } from "@/actions/listings/create-listing";

export default async function CreateListingPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("BUYER_SELLER")) {
    redirect("/login?redirectTo=/seller/listings/create");
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Listings</span>
      <h1 className="mt-2 text-2xl">Create listing</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Submitted listings go to an admin for review before they appear in the marketplace.
      </p>

      {categories.length === 0 ? (
        <p className="mt-6 rounded-tag border border-dashed border-line px-6 py-8 text-center text-sm text-ink-soft">
          There are no categories yet — an admin needs to add at least one before you can list an item.
        </p>
      ) : (
        <div className="mt-6">
          <ListingForm action={createListingAction} categories={categories} submitLabel="Submit for review" />
        </div>
      )}
    </div>
  );
}
