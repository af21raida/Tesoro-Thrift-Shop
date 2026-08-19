"use client";

import { useState, useTransition } from "react";
import { setUserActiveAction } from "@/actions/users/set-user-active";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  userId,
  userName,
  active,
}: {
  userId: string;
  userName: string;
  active: boolean;
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={active ? "danger" : "secondary"}
        disabled={isPending}
        onClick={() => {
          if (active && !window.confirm(`Deactivate ${userName}? They won't be able to log in until reactivated.`)) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await setUserActiveAction(userId, !active);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </Button>
      {error && <p className="max-w-[16rem] text-right text-xs text-stamp">{error}</p>}
    </div>
  );
}
