"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Section 13 (navigation): role-gated, matching exactly what each role is
 * actually authorized to do server-side — not a superset trimmed for
 * looks. This is presentation only ("don't rely on hiding functionality"
 * still holds: every one of these actions is independently enforced in
 * its Server Action regardless of what links render here — see
 * actions/cart/cart-actions.ts, actions/checkout/checkout.ts,
 * actions/auction/place-bid.ts, actions/listings/create-listing.ts).
 * Hiding the link is purely so a STAFF or ADMIN account never sees an
 * inviting "Cart" link that would just reject them anyway.
 */
const PUBLIC_NAV_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/auctions", label: "Auctions" },
  { href: "/categories", label: "Categories" },
];

export interface HeaderNavProps {
  session: { email: string; unreadCount: number } | null;
  isAdmin: boolean;
  isStaff: boolean;
  isBuyerSeller: boolean;
}

/**
 * Client component so the mobile hamburger can toggle open/closed state.
 * No animation library, no transition effects — the menu simply
 * shows/hides. Split out of Header (a server component, so it can read
 * the session) purely for that one piece of interactivity.
 */
export function HeaderNav({ session, isAdmin, isStaff, isBuyerSeller }: HeaderNavProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-8 font-body text-base md:flex">
        {PUBLIC_NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-paper/70 hover:text-brass-light">
            {link.label}
          </Link>
        ))}
        {isBuyerSeller && (
          <Link href="/seller" className="text-paper/70 hover:text-brass-light">
            Sell
          </Link>
        )}
        {isStaff && (
          <Link href="/staff" className="text-paper/70 hover:text-brass-light">
            Staff
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin" className="text-paper/70 hover:text-brass-light">
            Admin
          </Link>
        )}
      </nav>

      <div className="hidden items-center gap-5 text-base md:flex">
        {session ? (
          <>
            {isBuyerSeller && (
              <Link href="/bids" className="text-paper/70 hover:text-brass-light">
                My bids
              </Link>
            )}
            <Link href="/notifications" className="text-paper/70 hover:text-brass-light">
              Notifications
              {session.unreadCount > 0 && (
                <span className="ml-1 tag-badge border-brass-light text-brass-light">{session.unreadCount}</span>
              )}
            </Link>
            {isBuyerSeller && (
              <Link href="/orders" className="text-paper/70 hover:text-brass-light">
                Orders
              </Link>
            )}
            {isBuyerSeller && (
              <Link href="/cart" className="text-paper/70 hover:text-brass-light">
                Cart
              </Link>
            )}
            <Link
              href="/profile"
              className="rounded-tag border border-paper/40 px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-paper hover:text-ink"
            >
              {session.email}
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="text-paper/70 hover:text-brass-light">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-tag bg-teal px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide text-paper hover:bg-teal-light"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      {/* Mobile: simple hamburger toggle, no animation. */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-tag border border-paper/40 text-paper md:hidden"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full border-b border-line bg-paper px-6 py-4 md:hidden">
          <nav aria-label="Primary" className="flex flex-col gap-3 font-body text-sm">
            {PUBLIC_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            {isBuyerSeller && (
              <Link href="/seller" className="text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                Sell
              </Link>
            )}
            {isStaff && (
              <Link href="/staff" className="text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                Staff
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
            <div className="mt-2 border-t border-line pt-3">
              {session ? (
                <>
                  {isBuyerSeller && (
                    <Link href="/bids" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                      My bids
                    </Link>
                  )}
                  <Link href="/notifications" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                    Notifications{session.unreadCount > 0 ? ` (${session.unreadCount})` : ""}
                  </Link>
                  {isBuyerSeller && (
                    <Link href="/orders" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                      Orders
                    </Link>
                  )}
                  {isBuyerSeller && (
                    <Link href="/cart" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                      Cart
                    </Link>
                  )}
                  <Link href="/profile" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                    {session.email}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                  <Link href="/register" className="block py-1 text-ink-soft hover:text-ink" onClick={() => setOpen(false)}>
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
