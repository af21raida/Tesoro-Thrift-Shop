import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { StockBadge } from "@/components/inventory/stock-badge";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /admin/* to ADMIN,
  // but this page checks for itself too rather than trusting that alone —
  // same convention as the Phase 4 profile page.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/products");
  }

  const products = await prisma.product.findMany({
    where: { type: "THRIFT_STOCK" },
    include: { category: true, inventory: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="tag-badge text-ink-soft">Products</span>
          <h1 className="mt-2 text-2xl">Manage products</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Store-owned stock only. Seller listings and auction items are moderated/managed in their own flows.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          + Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No products yet. Add the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-tag border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/products/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{product.category.name}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(product.price.toString())}</td>
                  <td className="px-4 py-3">
                    {product.inventory && (
                      <StockBadge
                        stock={product.inventory.stock}
                        lowStockThreshold={product.inventory.lowStockThreshold}
                        available={product.inventory.available}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="rounded-tag border border-ink px-3 py-1.5 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton productId={product.id} productName={product.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-ink-soft">
        Need to add or rename categories?{" "}
        <Link href="/admin/categories" className="underline">
          Manage categories
        </Link>
        .
      </p>
    </div>
  );
}
