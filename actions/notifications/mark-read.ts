"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/validation/action-result";

/** Marks every one of the current user's own notifications as read — never takes an id, so there's no way to mark another user's notification via a crafted request. */
export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true },
  });

  revalidatePath("/notifications");
  return { success: true };
}
