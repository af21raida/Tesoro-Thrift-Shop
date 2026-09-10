import { prisma } from "@/lib/db/prisma";

/**
 * Homepage search/category bar shown directly beneath the burgundy header.
 * A plain GET <form> to /products — the same filter mechanism the /products
 * page's ProductFilters uses — so results are shareable/bookmarkable and need
 * no client JS. Styled to read as the bottom of the header (#343952 band)
 * while the inputs stay cream for contrast and readability.
 */
export async function HomeSearchBar(): Promise<React.JSX.Element> {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="bg-[#343952]">
      <form
        action="/products"
        method="get"
        className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:gap-5"
      >
        <label htmlFor="home-search-q" className="font-mono text-xs uppercase tracking-wide text-brass-light md:w-16">
          Search
        </label>
        <input
          id="home-search-q"
          name="q"
          type="search"
          placeholder="Search products…"
          className="w-full rounded-tag border border-brass/40 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass-light md:flex-1"
        />
        <label htmlFor="home-search-category" className="font-mono text-xs uppercase tracking-wide text-brass-light md:w-24">
          Category
        </label>
        <select
          id="home-search-category"
          name="category"
          defaultValue=""
          className="w-full rounded-tag border border-brass/40 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass-light md:w-auto"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-tag bg-burgundy px-5 py-2 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-burgundy-dark"
        >
          Search
        </button>
      </form>
    </div>
  );
}