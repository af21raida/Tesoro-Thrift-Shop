import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ToggleActiveButton } from "@/components/users/toggle-active-button";

export const dynamic = "force-dynamic";

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "border-plum text-plum",
  STAFF: "border-brass text-brass-dark",
  BUYER_SELLER: "border-market text-market",
};

export default async function AdminUsersPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ADMIN")) {
    redirect("/login?redirectTo=/admin/users");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { orders: true, bids: true, listings: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="tag-badge text-ink-soft">Dashboards</span>
      <h1 className="mt-2 text-2xl">Manage users</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Deactivating blocks future logins without deleting their order/bid/listing history. See{" "}
        <span className="font-mono text-xs">actions/users/set-user-active.ts</span> for why this isn&apos;t a hard
        delete.
      </p>

      <div className="mt-6 overflow-x-auto rounded-tag border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-dim font-mono text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-3">
                  {row.name}
                  <br />
                  <span className="text-xs text-ink-soft">{row.email}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.roles.map((role) => (
                      <span key={role} className={`tag-badge ${ROLE_STYLES[role]}`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {row._count.orders} order{row._count.orders === 1 ? "" : "s"} · {row._count.bids} bid
                  {row._count.bids === 1 ? "" : "s"} · {row._count.listings} listing
                  {row._count.listings === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3">
                  <span className={`tag-badge ${row.active ? "border-market text-market" : "border-stamp text-stamp"}`}>
                    {row.active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.id === user.id ? (
                    <span className="text-xs text-ink-soft">You</span>
                  ) : (
                    <ToggleActiveButton userId={row.id} userName={row.name} active={row.active} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
