"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/**
 * Display only — ticks down client-side purely so a bidder doesn't have
 * to refresh to see time passing. It never gates whether a bid is
 * accepted; that's decided entirely server-side, against Postgres's own
 * `now()`, inside the atomic UPDATE in lib/auction/bidding.ts. A visitor
 * with a wrong or paused system clock can watch this say anything —
 * it cannot make the server accept or reject a bid outside the real
 * window.
 */
export function CountdownTimer({ target, label }: { target: string; label: string }): React.JSX.Element {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Avoids a hydration mismatch: the server has no idea what the client's
  // clock reads, so the first client render intentionally matches the
  // server's static placeholder before the interval takes over.
  if (now === null) {
    return (
      <span className="font-mono text-base text-ink-soft">
        {label} —
      </span>
    );
  }

  return (
    <span className="font-mono text-base text-ink">
      {label} {formatRemaining(targetMs - now)}
    </span>
  );
}
