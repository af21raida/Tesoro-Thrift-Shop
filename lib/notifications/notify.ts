import "server-only";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * The Notification model (Phase 2) and its NotificationType enum have
 * existed since the schema was designed, referenced by three phases —
 * listing review (6), auction win (8), low stock (9) — but never had a
 * shared creation helper until now. Phase 8's auction finalization
 * already inserts an AUCTION_WON row directly against its own
 * `Prisma.TransactionClient` (it has to: the notification must commit or
 * roll back atomically with the Order it's reporting on), so this module
 * doesn't replace that — `notify` below accepts the same client shape so
 * any caller with an open transaction can still route through it instead
 * of writing the same `.notification.create` shape twice.
 */
type DbClient = typeof prisma | Prisma.TransactionClient;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
}

export async function notify(input: NotifyInput, client: DbClient = prisma): Promise<void> {
  await client.notification.create({ data: input });
}

/** Fan-out helper for events with no single recipient — e.g. "notify admin" (Staff use-case diagram) when any admin could act on it. */
export async function notifyRole(
  role: "ADMIN" | "STAFF",
  input: Omit<NotifyInput, "userId">,
  client: DbClient = prisma,
): Promise<void> {
  const recipients = await client.user.findMany({
    where: { roles: { has: role }, active: true },
    select: { id: true },
  });
  if (recipients.length === 0) return;
  await client.notification.createMany({
    data: recipients.map((user) => ({ userId: user.id, ...input })),
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
