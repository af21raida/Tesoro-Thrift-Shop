import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "@/components/auth/logout-button";

const ROLE_LABELS: Record<string, string> = {
  BUYER_SELLER: "Buyer / Seller",
  ADMIN: "Administrator",
  STAFF: "Staff",
};

export default async function ProfilePage(): Promise<React.JSX.Element> {
  // Belt-and-suspenders: middleware.ts already redirects unauthenticated
  // requests to /admin|/staff|/seller|/profile|/cart|/orders|/bids before
  // this ever renders, but the page checks for itself too rather than
  // trusting that edge-level gate alone.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirectTo=/profile");
  }

  // Phase 12: every BUYER_SELLER account can already sell/auction — there's
  // no separate "become a seller" upgrade step anymore (see
  // actions/listings/create-listing.ts and actions/auction/create-auction.ts,
  // both of which now accept BUYER_SELLER directly).
  const canSell = user.roles.includes("BUYER_SELLER");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl">My profile</h1>

      <dl className="mt-6 grid grid-cols-[120px_1fr] gap-y-3 rounded-tag border border-line bg-paper-dim p-6 text-sm">
        <dt className="text-ink-soft">Name</dt>
        <dd>{user.name}</dd>

        <dt className="text-ink-soft">Email</dt>
        <dd className="font-mono">{user.email}</dd>

        <dt className="text-ink-soft">Roles</dt>
        <dd className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <span key={role} className="tag-badge text-market">
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
        </dd>

        <dt className="text-ink-soft">Member since</dt>
        <dd>{user.createdAt.toLocaleDateString()}</dd>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canSell && (
          <Link
            href="/seller"
            className="rounded-tag border border-ink px-4 py-2 font-display font-semibold text-xs uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            Go to seller dashboard
          </Link>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
