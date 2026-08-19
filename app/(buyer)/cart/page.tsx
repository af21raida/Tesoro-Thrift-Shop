import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { CartItemRow, type CartItemRowData } from "@/components/cart/cart-item-row";
import { CheckoutButton } from "@/components/cart/checkout-button";
import { formatCurrency } from "@/lib/format/currency";

function isPurchasableListingStatus(status: string): boolean {
  return status === "APPROVED" || status === "ACTIVE";
}

export default async function CartPage(): Promise<React.JSX.Element> {
  // middleware.ts already redirects unauthenticated requests to /cart, but
  // (per the Phase 4 pattern established on the profile page) the page
  // itself never assumes that layer caught it.
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/cart");

  const cart = await prisma.cart.findUnique({
    where: { userId: session.userId },
    include: {
      items: {
        orderBy: { addedAt: "asc" },
        include: { product: { include: { inventory: true, listing: true } } },
      },
    },
  });

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl">Your cart is empty</h1>
        <p className="mt-2 text-sm text-ink-soft">Browse the store to find something worth thrifting.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          Browse products
        </Link>
      </div>
    );
  }

  let total = new Prisma.Decimal(0);
  let hasBlockingWarning = false;

  const rows: CartItemRowData[] = items.map((item) => {
    const { product } = item;
    let warning: string | null = null;
    let isEditableQuantity = false;
    let maxQuantity: number | null = null;

    if (product.type === "THRIFT_STOCK") {
      isEditableQuantity = true;
      maxQuantity = product.inventory?.stock ?? 0;
      if (!product.inventory || !product.inventory.available) {
        warning = "No longer available";
      } else if (product.inventory.stock <= 0) {
        warning = "Out of stock";
      } else if (item.quantity > product.inventory.stock) {
        warning = `Only ${product.inventory.stock} left`;
      }
    } else if (product.type === "USER_LISTING") {
      if (!product.listing || !isPurchasableListingStatus(product.listing.status)) {
        warning = "No longer available";
      }
    } else {
      warning = "Not purchasable";
    }

    if (warning) hasBlockingWarning = true;

    const lineTotal = product.price.mul(item.quantity);
    total = total.add(lineTotal);

    return {
      id: item.id,
      quantity: item.quantity,
      unitPrice: product.price.toString(),
      lineTotal: lineTotal.toFixed(2),
      isEditableQuantity,
      maxQuantity,
      warning,
      product: { id: product.id, name: product.name, image: product.images[0] ?? null },
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl">Your cart</h1>

      <div className="mt-6 rounded-tag border border-line bg-paper">
        <div className="divide-y divide-line px-4">
          {rows.map((row) => (
            <CartItemRow key={row.id} item={row} />
          ))}
        </div>
      </div>

      {hasBlockingWarning && (
        <p className="mt-4 rounded-tag border border-brass bg-brass/5 px-3 py-2 text-xs text-brass-dark">
          Some items in your cart are no longer available at the requested quantity. Remove or adjust them before
          checking out — checkout re-checks stock and listing status and will refuse anything that&apos;s changed.
        </p>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <div>
          <span className="block font-mono text-xs uppercase tracking-wide text-ink-soft">Estimated total</span>
          <span className="font-mono text-xl font-semibold text-ink">{formatCurrency(total.toFixed(2))}</span>
        </div>
        <CheckoutButton disabled={hasBlockingWarning} />
      </div>
    </div>
  );
}
