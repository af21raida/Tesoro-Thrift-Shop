import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { StockBadge } from "@/components/inventory/stock-badge";
import { StockUpdateForm } from "@/components/inventory/stock-update-form";

export const dynamic = "force-dynamic";

/**
 * Staff can flip a product's availability (and, via the same form, correct
 * its stock count), and — via the "Add product" link below, which posts
 * through the same createProductAction ADMIN uses — create brand-new
 * store-owned (THRIFT_STOCK) products. Editing catalog fields on an
 * *existing* product (name/price/description/category) stays Admin-only.
 * See actions/products/create-product.ts and update-stock.ts for the
 * enforcement.
 */
export default async function StaffProductsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("STAFF")) {
    redirect("/login?redirectTo=/staff/products");
  }

  const products = await prisma.product.findMany({
    where: { inventory: { isNot: null } },
    include: { category: true, inventory: true },
    orderBy: { name: "asc" },
  });
  const withInventory = products.filter(
    (product): product is typeof product & { inventory: NonNullable<typeof product.inventory> } =>
      product.inventory !== null,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="tag-badge text-ink-soft">Products</span>
          <h1 className="mt-2 text-2xl">Product availability</h1>
          <p className="mt-1 text-sm text-ink-soft">Toggle whether a product can currently be purchased.</p>
        </div>
        <Link
          href="/staff/products/new"
          className="rounded-tag border border-ink px-3 py-1.5 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          + Add product
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {withInventory.length === 0 ? (
          <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
            No store products yet.
          </p>
        ) : (
          withInventory.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-4 rounded-tag border border-line p-4">
              <div>
                <p>{product.name}</p>
                <p className="font-mono text-xs text-ink-soft">{product.category.name}</p>
                <div className="mt-1">
                  <StockBadge
                    stock={product.inventory.stock}
                    lowStockThreshold={product.inventory.lowStockThreshold}
                    available={product.inventory.available}
                  />
                </div>
              </div>
              <StockUpdateForm
                productId={product.id}
                stock={product.inventory.stock}
                lowStockThreshold={product.inventory.lowStockThreshold}
                available={product.inventory.available}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
