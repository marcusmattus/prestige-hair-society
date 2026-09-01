"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updatePreferencesAction, type ActionResult } from "@/lib/account/actions";

type Preferences = {
  marketingEmail: boolean;
  marketingSms: boolean;
  reminderEmail: boolean;
  reminderSms: boolean;
};

export function PreferencesForm({ defaults }: { defaults: Preferences }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updatePreferencesAction,
    null,
  );

  return (
    <form action={action} className="max-w-[560px]">
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

      <fieldset className="mb-8">
        <legend className="mb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Appointment reminders
        </legend>
        <div className="grid gap-3">
          <Toggle
            name="reminderEmail"
            defaultChecked={defaults.reminderEmail}
            title="Email reminders"
            description="Two days before your appointment."
          />
          <Toggle
            name="reminderSms"
            defaultChecked={defaults.reminderSms}
            title="Text reminders"
            description="A day before, and a short nudge on the day."
          />
        </div>
      </fieldset>

      <fieldset className="mb-8">
        <legend className="mb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Salon news
        </legend>
        <div className="grid gap-3">
          <Toggle
            name="marketingEmail"
            defaultChecked={defaults.marketingEmail}
            title="Email"
            description="Occasional news, offers and aftercare advice."
          />
          <Toggle
            name="marketingSms"
            defaultChecked={defaults.marketingSms}
            title="Text"
            description="Occasional offers. Rarely more than once a month."
          />
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-line px-4 py-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-ink"
      />
      <span>
        <span className="block text-[15px] text-ink">{title}</span>
        <span className="block text-[13px] leading-[1.55] text-muted">{description}</span>
      </span>
    </label>
  );
}
