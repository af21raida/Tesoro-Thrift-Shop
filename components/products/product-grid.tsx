import { ProductCard, type ProductCardData } from "./product-card";

export function ProductGrid({ products }: { products: ProductCardData[] }): React.JSX.Element {
  if (products.length === 0) {
    return (
      <p className="rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
        No products found. Try a different category or search term.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
