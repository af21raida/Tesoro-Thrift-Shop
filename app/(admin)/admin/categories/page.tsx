import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { CategoryForm } from "@/components/categories/category-form";
import { DeleteCategoryButton } from "@/components/categories/delete-category-button";
import { createCategoryAction, updateCategoryAction } from "@/actions/products/category-actions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/categories");
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Categories</span>
      <h1 className="mt-2 text-2xl">Manage categories</h1>

      <div className="mt-6 rounded-tag border border-line bg-paper-dim p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Add a category</h2>
        <CategoryForm action={createCategoryAction} submitLabel="Add" />
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {categories.map((category) => {
          const boundUpdate = updateCategoryAction.bind(null, category.id);
          return (
            <li key={category.id} className="rounded-tag border border-line p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-ink-soft">
                  /{category.slug} · {category._count.products} product(s)
                </span>
                <DeleteCategoryButton categoryId={category.id} categoryName={category.name} />
              </div>
              <CategoryForm
                action={boundUpdate}
                submitLabel="Save"
                defaultValues={{ name: category.name, description: category.description ?? "" }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
