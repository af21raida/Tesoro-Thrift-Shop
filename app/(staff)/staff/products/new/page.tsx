import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ProductForm } from "@/components/products/product-form";
import { createProductAction } from "@/actions/products/create-product";

/**
 * Staff counterpart to app/(admin)/admin/products/new/page.tsx — same
 * form, same Server Action, same THRIFT_STOCK + Inventory write path
 * (see actions/products/create-product.ts, which now allows both ADMIN
 * and STAFF). No duplicate product/inventory system: this page only
 * supplies a STAFF-reachable route and role check for a flow that was
 * already ADMIN-only-in-the-UI despite the server action itself now
 * permitting STAFF.
 */
export default async function StaffNewProductPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("STAFF")) {
    redirect("/login?redirectTo=/staff/products/new");
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/staff/products" className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink">
        ← Product availability
      </Link>
      <span className="mt-4 block tag-badge text-ink-soft">Products</span>
      <h1 className="mt-2 text-2xl">Add product</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Creates a store-owned product with its own inventory, same as an admin-added product.
      </p>

      {categories.length === 0 ? (
        <p className="mt-6 rounded-tag border border-dashed border-line px-6 py-8 text-center text-sm text-ink-soft">
          No categories exist yet. Ask an admin to create one before adding products.
        </p>
      ) : (
        <div className="mt-6">
          <ProductForm action={createProductAction} categories={categories} submitLabel="Create product" />
        </div>
      )}
    </div>
  );
}
