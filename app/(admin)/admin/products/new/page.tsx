import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ProductForm } from "@/components/products/product-form";
import { createProductAction } from "@/actions/products/create-product";

export default async function NewProductPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/products/new");
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Products</span>
      <h1 className="mt-2 text-2xl">Add product</h1>

      {categories.length === 0 ? (
        <p className="mt-6 rounded-tag border border-dashed border-line px-6 py-8 text-center text-sm text-ink-soft">
          Create at least one category before adding products. Go to{" "}
          <a href="/admin/categories" className="underline">
            Manage categories
          </a>
          .
        </p>
      ) : (
        <div className="mt-6">
          <ProductForm action={createProductAction} categories={categories} submitLabel="Create product" />
        </div>
      )}
    </div>
  );
}
