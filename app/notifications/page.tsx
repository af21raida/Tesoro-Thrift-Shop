import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  LISTING_APPROVED: "Listing approved",
  LISTING_REJECTED: "Listing rejected",
  LOW_STOCK: "Low stock",
  AUCTION_WON: "Auction won",
  AUCTION_ENDED: "Auction ended",
  ORDER_CONFIRMED: "Order confirmed",
  GENERIC: "Notice",
};

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Notifications</h1>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Listing decisions, auction wins, and (for admins) low-stock alerts land here.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-8 rounded-tag border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          Nothing yet.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-tag border px-4 py-3 ${notification.read ? "border-line" : "border-plum bg-plum/5"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                  {TYPE_LABELS[notification.type] ?? notification.type}
                </span>
                <span className="font-mono text-[11px] text-ink-soft">{notification.createdAt.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-ink">{notification.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
