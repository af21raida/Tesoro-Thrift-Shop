import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getUnreadCount } from "@/lib/notifications/notify";
import { HeaderNav } from "./header-nav";

export async function Header(): Promise<React.JSX.Element> {
  const session = await getSession();
  const unreadCount = session ? await getUnreadCount(session.userId) : 0;

  const isAdmin = session?.roles.includes("ADMIN") ?? false;
  const isStaff = session?.roles.includes("STAFF") ?? false;
  const isBuyerSeller = session?.roles.includes("BUYER_SELLER") ?? false;

  return (
    <header className="relative overflow-hidden border-b border-brass-dark/50 bg-burgundy">
      <div aria-hidden="true" className="header-wood-overlay" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-4">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-tag border border-brass/60 shadow-sm md:h-28 md:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element -- local logo asset */}
            <img
              src="/tesoro-logo.png"
              alt="Tesoro"
              width={913}
              height={911}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="hidden font-display text-xl tracking-wide text-paper sm:inline">Tesoro</span>
        </Link>

        <HeaderNav
          session={session ? { email: session.email, unreadCount } : null}
          isAdmin={isAdmin}
          isStaff={isStaff}
          isBuyerSeller={isBuyerSeller}
        />
      </div>
    </header>
  );
}
