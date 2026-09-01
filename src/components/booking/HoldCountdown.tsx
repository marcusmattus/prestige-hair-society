"use client";

import { useEffect, useReducer, useRef } from "react";

/**
 * Countdown on a held slot.
 *
 * The hold's real expiry lives in the database; this only displays it, so a
 * paused tab or a skewed clock cannot extend a hold. When it reaches zero we
 * tell the parent, which sends the customer back to pick a time again rather
 * than letting them pay for a slot that has been released.
 *
 * The remaining time is derived during render from `expiresAt` and a ticking
 * counter, rather than being copied into state -- there is only one source of
 * truth, and changing `expiresAt` needs no resynchronisation.
 */
export function HoldCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const firedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = remaining(expiresAt);

  // A new hold re-arms the callback.
  useEffect(() => {
    firedRef.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (secondsLeft <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpired();
    }
  }, [secondsLeft, onExpired]);

  if (secondsLeft <= 0) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const urgent = secondsLeft <= 120;

  return (
    <p
      // Polite, not assertive: this must not interrupt a screen reader every
      // second while someone is filling in the form.
      aria-live="polite"
      className={urgent ? "text-[13px] text-[#B4483C]" : "text-[13px] text-muted"}
    >
      Slot held for{" "}
      <span className="tabular-nums">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
    </p>
  );
}

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
}
