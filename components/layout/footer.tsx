import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/auctions", label: "Auctions" },
  { href: "/categories", label: "Categories" },
  { href: "/register", label: "Sell an item" },
];

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <span className="font-display text-lg tracking-tight text-ink">Tesoro</span>
          <p className="mt-2 text-sm text-ink-soft">
            A secondhand marketplace and auction house — every item has a history, some are still being written.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-line px-6 py-4 text-center text-xs text-ink-soft">
        &copy; {new Date().getFullYear()} Tesoro. All rights reserved.
      </div>
    </footer>
  );
}
