"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  updateNotificationSettingsAction,
  type SettingsResult,
} from "@/lib/studio/settings-actions";

export function NotificationSettingsForm({
  defaults,
}: {
  defaults: {
    notificationEmail: string;
    notifyOnBooking: boolean;
    notifyOnCancellation: boolean;
    fallbackEmail: string | null;
  };
}) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updateNotificationSettingsAction,
    null,
  );

  return (
    <form action={action}>
      {state?.error && (
        <p role="alert" className="mb-5 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mb-5 text-[14px] text-moss">
          {state.message}
        </p>
      )}

      <Field
        label="Send alerts to"
        description={
          defaults.fallbackEmail
            ? `Leave blank to use the salon's contact address, ${defaults.fallbackEmail}.`
            : "Leave blank and no alert is sent, because there is no contact address to fall back to."
        }
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="notificationEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="owner@example.com"
            defaultValue={defaults.notificationEmail}
          />
        )}
      </Field>

      <fieldset className="mt-6">
        <legend className="mb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Tell me when
        </legend>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-line px-4 py-4">
            <input
              type="checkbox"
              name="notifyOnBooking"
              defaultChecked={defaults.notifyOnBooking}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-ink"
            />
            <span>
              <span className="block text-[15px] text-ink">Somebody books</span>
              <span className="block text-[13px] leading-[1.55] text-muted">
                Sent once the deposit clears, with the service, time, contact
                details and what they have paid.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-line px-4 py-4">
            <input
              type="checkbox"
              name="notifyOnCancellation"
              defaultChecked={defaults.notifyOnCancellation}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-ink"
            />
            <span>
              <span className="block text-[15px] text-ink">
                Somebody cancels
              </span>
              <span className="block text-[13px] leading-[1.55] text-muted">
                With whether the deposit was refunded or retained under the
                policy.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <Button type="submit" className="mt-6" disabled={pending}>
        {pending ? "Saving…" : "Save alert settings"}
      </Button>
    </form>
  );
}
