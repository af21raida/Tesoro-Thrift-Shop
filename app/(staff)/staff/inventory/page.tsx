import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { StockBadge } from "@/components/inventory/stock-badge";
import { StockUpdateForm } from "@/components/inventory/stock-update-form";
import { isLowStock } from "@/lib/inventory/stock";

export const dynamic = "force-dynamic";

export default async function StaffInventoryPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("STAFF")) {
    redirect("/login?redirectTo=/staff/inventory");
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
  const lowStock = withInventory.filter((product) =>
    isLowStock(product.inventory.stock, product.inventory.lowStockThreshold),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Inventory</span>
      <h1 className="mt-2 text-2xl">Store inventory</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Correct stock counts after a delivery, a physical recount, or an in-store sale. This is the same stock
        record checkout automatically decrements — use this page for manual corrections, not routine sales.
      </p>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-tag border border-brass bg-brass/5 px-4 py-3 text-sm text-brass-dark">
          {lowStock.length} product(s) at or below their low-stock threshold: {lowStock.map((p) => p.name).join(", ")}
        </div>
      )}

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
