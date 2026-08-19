import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductFilters } from "@/components/products/product-filters";
import { PUBLICLY_VISIBLE_PRODUCT } from "@/lib/listings/visibility";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string; category?: string };
}

export default async function ProductsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const query = searchParams.q?.trim();
  const categorySlug = searchParams.category?.trim();

  const where: Prisma.ProductWhereInput = {
    AND: [
      PUBLICLY_VISIBLE_PRODUCT,
      ...(query ? [{ name: { contains: query, mode: "insensitive" as const } }] : []),
      ...(categorySlug ? [{ category: { slug: categorySlug } }] : []),
    ],
  };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, inventory: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="mb-8 flex flex-col gap-2">
        <span className="tag-badge w-fit text-ink-soft">Browse</span>
        <h1 className="text-3xl">Shop</h1>
        <p className="text-sm text-ink-soft">
          Everything currently in the store — filter by category or search by name.
        </p>
      </div>

      <div className="mb-10 rounded-tag border border-line bg-paper-dim px-4 py-4">
        <ProductFilters categories={categories} activeSlug={categorySlug} query={query} />
      </div>

      <ProductGrid
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price.toString(),
          condition: product.condition,
          images: product.images,
          category: { name: product.category.name, slug: product.category.slug },
          inventory: product.inventory
            ? {
                stock: product.inventory.stock,
                lowStockThreshold: product.inventory.lowStockThreshold,
                available: product.inventory.available,
              }
            : null,
        }))}
      />
    </div>
  );
}
