"use client";

import { useTransition } from "react";
import { markAllNotificationsReadAction } from "@/actions/notifications/mark-read";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton(): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={isPending}
      onClick={() => startTransition(() => void markAllNotificationsReadAction())}
    >
      {isPending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
