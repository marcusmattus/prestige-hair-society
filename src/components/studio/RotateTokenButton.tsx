"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  rotateCalendarTokenAction,
  type SettingsResult,
} from "@/lib/studio/settings-actions";

/**
 * Rotation breaks every existing subscription to that calendar, so it confirms
 * first and says what will happen rather than asking "are you sure?".
 */
export function RotateTokenButton({
  target,
  staffId,
  label,
}: {
  target: "salon" | "staff";
  staffId?: string;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    rotateCalendarTokenAction,
    null,
  );

  if (state?.message) {
    return <span className="max-w-[380px] text-[13px] text-moss">{state.message}</span>;
  }

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Rotate link
      </Button>
    );
  }

  return (
    <div className="text-right">
      <form action={action} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="target" value={target} />
        {staffId && <input type="hidden" name="staffId" value={staffId} />}
        <span className="text-[13px] text-muted">
          Stop every device subscribed to {label}?
        </span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Rotating…" : "Yes, rotate"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
          Keep
        </Button>
      </form>

      {state?.error && (
        <p role="alert" className="mt-2 text-[13px] text-[#B4483C]">
          {state.error}
        </p>
      )}
    </div>
  );
}
