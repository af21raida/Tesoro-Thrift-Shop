interface ProductFiltersProps {
  categories: { id: string; name: string; slug: string }[];
  activeSlug?: string;
  query?: string;
}

/**
 * A plain GET <form> rather than a Server Action — filtering is just
 * navigation to a new search-params URL, which keeps the result
 * shareable/bookmarkable and needs no client JS.
 */
export function ProductFilters({ categories, activeSlug, query }: ProductFiltersProps): React.JSX.Element {
  return (
    <form action="/products" method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="q" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search products…"
          className="rounded-tag border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={activeSlug ?? ""}
          className="rounded-tag border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-ink hover:bg-ink hover:text-paper"
      >
        Apply
      </button>
    </form>
  );
}
