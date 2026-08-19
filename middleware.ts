import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth/types";
import { getAuthSecretBytes } from "@/lib/auth/secret";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "thrift_session";

/**
 * Route-prefix → roles allowed to enter. This is a coarse, fast, edge-level
 * gate that redirects obviously-unauthorized navigations before a page even
 * renders. It is a UX convenience, NOT the security boundary — every
 * Server Action and Route Handler underneath still calls requireRole()
 * from lib/auth/rbac.ts, because middleware can be misconfigured or
 * bypassed by calling an action directly, and the brief is explicit that
 * hiding routes/buttons is not sufficient authorization.
 */
const PROTECTED_PREFIXES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/staff", roles: ["STAFF"] },
  // Phase 12 fix: BUYER/SELLER merged into BUYER_SELLER (see
  // prisma/schema.prisma). Path kept as "/seller" — renaming the route
  // itself isn't required by the role merge and would break existing links
  // for no benefit ("smallest safe change").
  { prefix: "/seller", roles: ["BUYER_SELLER"] },
  { prefix: "/profile", roles: ["BUYER_SELLER", "ADMIN", "STAFF"] },
  { prefix: "/notifications", roles: ["BUYER_SELLER", "ADMIN", "STAFF"] },
  // Phase 12: cart/orders/bids are buying-side actions. STAFF must not
  // checkout or bid, and ADMIN must not buy or bid (new role-model
  // requirement) — previously these three listed ADMIN/STAFF alongside
  // BUYER/SELLER, which was only ever a coarse edge convenience and never
  // the real boundary (see cart-actions.ts/checkout.ts/place-bid.ts, which
  // now enforce this with requireRole("BUYER_SELLER") regardless of what
  // middleware allows) — narrowed here too so the edge-level gate and the
  // Server Action boundary agree instead of one being misleadingly wider.
  // Phase 12: cart/bids are purely buying-side actions, narrowed to
  // BUYER_SELLER only (STAFF must not checkout/bid; ADMIN must not
  // buy/bid — see cart-actions.ts/place-bid.ts for the real Server Action
  // boundary this mirrors). /orders is different: ADMIN has always been
  // able to view *any* order here (see app/(buyer)/orders/[id]/page.tsx's
  // own-or-admin check, predating this role-model change) as part of its
  // existing transaction-management capability — that's viewing, not
  // buying, so ADMIN stays on the list for this one prefix while STAFF
  // (which has no order-viewing use case at all — it can't buy) does not.
  { prefix: "/cart", roles: ["BUYER_SELLER"] },
  { prefix: "/orders", roles: ["BUYER_SELLER", "ADMIN"] },
  { prefix: "/bids", roles: ["BUYER_SELLER"] },
];

/**
 * Phase 11 fix (audit issue #8): this previously fell back to an empty
 * string instead of throwing when AUTH_SECRET was unset, which was
 * inconsistent with lib/auth/session.ts (which always threw on a missing
 * secret) and meant a misconfigured deployment would fail differently at
 * the edge than in the Server Action layer. Now goes through the same
 * lib/auth/secret.ts check session.ts uses, so a missing *or* still-a-
 * placeholder AUTH_SECRET fails identically in both places. The throw is
 * caught in readSession below (same try/catch that already handles a bad
 * signature or expired token), so this fails *closed* — treated as "no
 * session" — rather than crashing the whole edge function on every
 * request.
 */
async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecretBytes());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const match = PROTECTED_PREFIXES.find((entry) => pathname.startsWith(entry.prefix));
  if (!match) return NextResponse.next();

  const session = await readSession(request);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAllowed = session.roles.some((role) => match.roles.includes(role));
  if (!isAllowed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/seller/:path*",
    "/profile/:path*",
    "/cart/:path*",
    "/orders/:path*",
    "/bids/:path*",
    "/notifications/:path*",
  ],
};
