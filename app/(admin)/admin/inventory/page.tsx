import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { StockBadge } from "@/components/inventory/stock-badge";
import { StockUpdateForm } from "@/components/inventory/stock-update-form";
import { isLowStock } from "@/lib/inventory/stock";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already restricts /admin/* to ADMIN.
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/inventory");
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
  const lowStockCount = withInventory.filter((product) =>
    isLowStock(product.inventory.stock, product.inventory.lowStockThreshold),
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Inventory</span>
      <h1 className="mt-2 text-2xl">Monitor inventory</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {lowStockCount > 0
          ? `${lowStockCount} product(s) at or below their low-stock threshold.`
          : "All products are above their low-stock threshold."}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {withInventory.length === 0 ? (
          <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
            No store products yet.{" "}
            <Link href="/admin/products/new" className="underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          withInventory.map((product) => (
            <div
              key={product.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-tag border p-4 ${
                isLowStock(product.inventory.stock, product.inventory.lowStockThreshold)
                  ? "border-brass bg-brass/5"
                  : "border-line"
              }`}
            >
              <div className="min-w-[10rem]">
                <Link href={`/products/${product.id}`} className="hover:underline">
                  {product.name}
                </Link>
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
