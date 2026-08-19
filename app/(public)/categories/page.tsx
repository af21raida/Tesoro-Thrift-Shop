import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function CategoriesPage(): Promise<React.JSX.Element> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <div className="mb-8 flex flex-col gap-2">
        <span className="tag-badge w-fit text-ink-soft">Browse</span>
        <h1 className="text-3xl">Categories</h1>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-ink-soft">No categories yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/categories/${category.slug}`}
                className="flex items-center justify-between rounded-tag border border-line px-4 py-3 hover:border-ink"
              >
                <span>{category.name}</span>
                <span className="font-mono text-xs text-ink-soft">{category._count.products}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
