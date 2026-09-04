"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { joinWaitlistAction, type WaitlistResult } from "@/lib/waitlist/actions";

type Option = { id: string; name: string };

const TIMES = [
  { value: "morning", label: "Morning", hint: "before 12:00" },
  { value: "afternoon", label: "Afternoon", hint: "12:00 – 17:00" },
  { value: "evening", label: "Evening", hint: "after 17:00" },
];

/**
 * Shown when a customer's preferred dates have nothing free. Prefilled from
 * whatever they had already chosen in the booking flow, so joining the list is
 * a confirmation rather than a second form.
 */
export function WaitlistForm({
  services,
  stylists,
  defaults,
  signedIn,
}: {
  services: Option[];
  stylists: Option[];
  defaults: {
    serviceId?: string;
    staffId?: string;
    earliestDate: string;
    latestDate: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState<WaitlistResult | null, FormData>(
    joinWaitlistAction,
    null,
  );
  const [done, setDone] = useState(false);

  if (state?.message && !done) {
    // Latch on success so the form does not invite a second identical entry.
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-[6px] border border-line bg-sand px-6 py-6">
        <div className="mb-2 h-3 w-3 rotate-45 bg-gold" />
        <h3 className="mb-2 font-serif text-[24px]">You are on the list</h3>
        <p className="text-[15px] leading-[1.7] text-muted">{state?.message}</p>
        <p className="mt-4 text-[13px] leading-[1.6] text-muted">
          Being on the list does not hold a slot. When one opens we email you a
          link that is yours for an hour, and you book it in the usual way.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-[6px] border border-line px-6 py-6">
      <h3 className="mb-2 font-serif text-[24px]">Join the waiting list</h3>
      <p className="mb-6 max-w-[520px] text-[15px] leading-[1.7] text-muted">
        Nothing free that suits you? Tell us what would, and we will email you
        the moment a cancellation matches.
      </p>

      {state?.error && (
        <p role="alert" className="mb-5 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              name="serviceId"
              defaultValue={defaults.serviceId}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Stylist" description="Leave as any to be matched sooner.">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              name="staffId"
              defaultValue={defaults.staffId ?? ""}
            >
              <option value="">Any available stylist</option>
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="From">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              name="earliestDate"
              type="date"
              defaultValue={defaults.earliestDate}
              required
            />
          )}
        </Field>
        <Field label="Until">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              name="latestDate"
              type="date"
              defaultValue={defaults.latestDate}
              required
            />
          )}
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] tracking-[0.12em] text-sage uppercase">
          Times that work
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TIMES.map((time) => (
            <label
              key={time.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-[4px] border border-line px-3.5 py-3"
            >
              <input
                type="checkbox"
                name="timesOfDay"
                value={time.value}
                defaultChecked
                className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
              />
              <span>
                <span className="block text-[14px]">{time.label}</span>
                <span className="block text-[12px] text-muted">{time.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!signedIn && (
        <fieldset className="mt-6">
          <legend className="mb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
            Where to reach you
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              {({ id }) => (
                <Input id={id} name="firstName" defaultValue={defaults.firstName} required />
              )}
            </Field>
            <Field label="Last name">
              {({ id }) => (
                <Input id={id} name="lastName" defaultValue={defaults.lastName} required />
              )}
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              {({ id }) => (
                <Input id={id} name="email" type="email" defaultValue={defaults.email} required />
              )}
            </Field>
            <Field label="Mobile number">
              {({ id }) => (
                <Input id={id} name="phone" type="tel" defaultValue={defaults.phone} required />
              )}
            </Field>
          </div>
        </fieldset>
      )}

      {signedIn && (
        <>
          <input type="hidden" name="firstName" value={defaults.firstName ?? ""} />
          <input type="hidden" name="lastName" value={defaults.lastName ?? ""} />
          <input type="hidden" name="email" value={defaults.email ?? ""} />
          <input type="hidden" name="phone" value={defaults.phone ?? ""} />
        </>
      )}

      <Button type="submit" className="mt-6" disabled={pending}>
        {pending ? "Adding you…" : "Add me to the list"}
      </Button>
    </form>
  );
}
