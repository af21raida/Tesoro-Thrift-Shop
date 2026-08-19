import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ProductGrid } from "@/components/products/product-grid";
import { PUBLICLY_VISIBLE_PRODUCT } from "@/lib/listings/visibility";

interface PageProps {
  params: { category: string };
}

export default async function CategoryPage({ params }: PageProps): Promise<React.JSX.Element> {
  const category = await prisma.category.findUnique({ where: { slug: params.category } });
  if (!category) notFound();

  const products = await prisma.product.findMany({
    where: { AND: [PUBLICLY_VISIBLE_PRODUCT, { categoryId: category.id }] },
    include: { category: true, inventory: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="mb-8 flex flex-col gap-2">
        <span className="tag-badge w-fit text-ink-soft">Category</span>
        <h1 className="text-3xl">{category.name}</h1>
        {category.description && <p className="text-sm text-ink-soft">{category.description}</p>}
      </div>

      <ProductGrid
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price.toString(),
          condition: product.condition,
          images: product.images,
          category: { name: category.name, slug: category.slug },
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
