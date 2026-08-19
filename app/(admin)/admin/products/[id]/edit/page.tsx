import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ProductForm } from "@/components/products/product-form";
import { updateProductAction } from "@/actions/products/update-product";

interface PageProps {
  params: { id: string };
}

export default async function EditProductPage({ params }: PageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect(`/login?redirectTo=/admin/products/${params.id}/edit`);
  }

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id }, include: { inventory: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();
  if (product.type !== "THRIFT_STOCK") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="rounded-tag border border-stamp bg-stamp/5 px-6 py-8 text-center text-sm text-stamp">
          This product is a {product.type === "USER_LISTING" ? "seller listing" : "auction item"} and is managed
          through its own flow, not here.
        </p>
      </div>
    );
  }

  const boundAction = updateProductAction.bind(null, product.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Products</span>
      <h1 className="mt-2 text-2xl">Edit product</h1>

      <div className="mt-6">
        <ProductForm
          action={boundAction}
          categories={categories}
          submitLabel="Save changes"
          defaultValues={{
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            condition: product.condition,
            categoryId: product.categoryId,
            images: product.images,
            stock: product.inventory?.stock ?? 0,
            lowStockThreshold: product.inventory?.lowStockThreshold ?? 5,
            available: product.inventory?.available ?? true,
          }}
        />
      </div>
    </div>
  );
}
