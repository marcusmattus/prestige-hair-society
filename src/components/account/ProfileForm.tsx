"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { updateProfileAction, type ActionResult } from "@/lib/account/actions";

type ProfileDefaults = {
  firstName: string;
  lastName: string;
  phone: string;
  birthday: string;
  hairGoals: string;
  accessibilityRequirements: string;
  allergies: string;
  favouriteStaffId: string;
};

export function ProfileForm({
  defaults,
  stylists,
}: {
  defaults: ProfileDefaults;
  stylists: { id: string; display_name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProfileAction,
    null,
  );

  return (
    <form action={action} className="max-w-[640px]">
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

      <fieldset className="mb-9">
        <legend className="mb-4 text-[13px] tracking-[0.12em] text-sage uppercase">
          Your details
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} name="firstName" defaultValue={defaults.firstName} autoComplete="given-name" required />
            )}
          </Field>
          <Field label="Last name">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} name="lastName" defaultValue={defaults.lastName} autoComplete="family-name" required />
            )}
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Mobile number" description="Used for appointment reminders.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" />
            )}
          </Field>
          <Field label="Birthday" description="Optional. We only use it to say happy birthday.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} name="birthday" type="date" defaultValue={defaults.birthday} />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="mb-9">
        <legend className="mb-4 text-[13px] tracking-[0.12em] text-sage uppercase">
          Your hair
        </legend>

        <Field
          label="Hair goals"
          description="What you are working towards. Your stylist reads this before you arrive."
        >
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} name="hairGoals" rows={3} defaultValue={defaults.hairGoals} />
          )}
        </Field>

        <div className="mt-4">
          <Field label="Favourite stylist" description="We will offer their availability first.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} name="favouriteStaffId" defaultValue={defaults.favouriteStaffId}>
                <option value="">No preference</option>
                {stylists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="mb-9">
        <legend className="mb-2 text-[13px] tracking-[0.12em] text-sage uppercase">
          Access and safety
        </legend>
        <p className="mb-4 max-w-[520px] text-[13px] leading-[1.6] text-muted">
          Both of these are optional. Allergy and sensitivity information counts
          as health data — we ask because a scalp reaction is worse than an
          awkward question, and you can clear it at any time. See our{" "}
          <a href="/privacy" className="text-moss underline">
            privacy notice
          </a>
          .
        </p>

        <Field
          label="Accessibility requirements"
          description="Anything that would make your visit easier."
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              name="accessibilityRequirements"
              rows={2}
              defaultValue={defaults.accessibilityRequirements}
            />
          )}
        </Field>

        <div className="mt-4">
          <Field
            label="Allergies and sensitivities"
            description="Including reactions to previous colour or products."
          >
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} name="allergies" rows={2} defaultValue={defaults.allergies} />
            )}
          </Field>
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
