"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  retireStaffAction,
  saveStaffAction,
  saveStaffServicesAction,
  type StaffResult,
} from "@/lib/studio/staff-actions";

const FIELD =
  "min-h-[44px] w-full rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]";

export type StaffRecord = {
  id: string;
  slug: string;
  displayName: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
  isBookable: boolean;
  isActive: boolean;
  displayOrder: number;
  serviceIds: string[];
  upcomingCount: number;
};

export type ServiceOption = {
  id: string;
  name: string;
  categoryName: string | null;
};

export function StaffEditor({
  staff,
  services,
}: {
  staff: StaffRecord[];
  services: ServiceOption[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {staff.length} stylist{staff.length === 1 ? "" : "s"}
        </p>
        <Button type="button" size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Add a stylist"}
        </Button>
      </div>

      {adding && (
        <div className="mb-8 rounded-[6px] border border-gold px-5 py-5">
          <h3 className="mb-4 font-serif text-[20px]">New stylist</h3>
          <StaffForm onDone={() => setAdding(false)} />
        </div>
      )}

      <ul className="grid gap-3">
        {staff.map((person) => {
          const open = openId === person.id;
          return (
            <li key={person.id} className="rounded-[6px] border border-line">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="text-[16px]">
                    {person.displayName}
                    {!person.isActive && (
                      <span className="ml-2 rounded-[3px] border border-line px-2 py-0.5 text-[12px] text-muted">
                        retired
                      </span>
                    )}
                    {person.isActive && !person.isBookable && (
                      <span className="ml-2 rounded-[3px] border border-gold px-2 py-0.5 text-[12px] text-gold">
                        not bookable online
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {person.title ?? "No title"} · {person.serviceIds.length} service
                    {person.serviceIds.length === 1 ? "" : "s"}
                    {person.upcomingCount > 0 && ` · ${person.upcomingCount} upcoming`}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(open ? null : person.id)}
                  aria-expanded={open}
                >
                  {open ? "Close" : "Edit"}
                </Button>
              </div>

              {open && (
                <div className="border-t border-line px-5 py-5">
                  <StaffForm record={person} onDone={() => setOpenId(null)} />

                  <hr className="my-8 border-line" />

                  <h4 className="mb-1 text-[15px] font-semibold">Services offered</h4>
                  <p className="mb-4 text-[13px] leading-[1.6] text-muted">
                    Only these appear when a customer picks this stylist.
                    Unticking one does not affect appointments already booked.
                  </p>
                  <ServicesForm
                    staffId={person.id}
                    services={services}
                    selected={person.serviceIds}
                  />

                  <hr className="my-8 border-line" />

                  <RetireForm staffId={person.id} name={person.displayName} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StaffForm({ record, onDone }: { record?: StaffRecord; onDone: () => void }) {
  const [state, action, pending] = useActionState<StaffResult | null, FormData>(
    saveStaffAction,
    null,
  );

  if (state?.message) {
    return (
      <div>
        <p role="status" className="mb-3 text-[14px] text-moss">
          {state.message}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form action={action}>
      {record && <input type="hidden" name="id" value={record.id} />}

      {state?.error && (
        <p role="alert" className="mb-4 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Name</span>
          <input
            name="displayName"
            defaultValue={record?.displayName}
            required
            className={FIELD}
          />
        </label>

        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Title</span>
          <input
            name="title"
            defaultValue={record?.title ?? ""}
            placeholder="Stylist and Hair Coach"
            className={FIELD}
          />
        </label>
      </div>

      <label className="mt-3 block text-[13px]">
        <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
          Biography
        </span>
        <textarea
          name="bio"
          rows={3}
          defaultValue={record?.bio ?? ""}
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="mt-3 block text-[13px]">
        <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
          Specialisms
        </span>
        <input
          name="specialties"
          defaultValue={record?.specialties.join(", ") ?? ""}
          placeholder="Silk press, Colour, Locs"
          className={FIELD}
        />
        <span className="mt-1.5 block text-[13px] text-muted">
          Separated by commas. Shown as tags on their profile page.
        </span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-line px-4 py-3">
          <input
            type="checkbox"
            name="isBookable"
            defaultChecked={record?.isBookable ?? true}
            className="mt-0.5 h-[18px] w-[18px] accent-ink"
          />
          <span>
            <span className="block text-[14px]">Bookable online</span>
            <span className="block text-[12px] text-muted">
              Untick for walk-ins only; they stay on the calendar.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-line px-4 py-3">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={record?.isActive ?? true}
            className="mt-0.5 h-[18px] w-[18px] accent-ink"
          />
          <span>
            <span className="block text-[14px]">Active</span>
            <span className="block text-[12px] text-muted">
              Shown on the public stylists page.
            </span>
          </span>
        </label>

        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Order</span>
          <input
            type="number"
            name="displayOrder"
            min={0}
            max={999}
            defaultValue={record?.displayOrder ?? 1}
            className={FIELD}
          />
        </label>
      </div>

      <Button type="submit" className="mt-5" disabled={pending}>
        {pending ? "Saving…" : record ? "Save changes" : "Add stylist"}
      </Button>
    </form>
  );
}

function ServicesForm({
  staffId,
  services,
  selected,
}: {
  staffId: string;
  services: ServiceOption[];
  selected: string[];
}) {
  const [state, action, pending] = useActionState<StaffResult | null, FormData>(
    saveStaffServicesAction,
    null,
  );

  const byCategory = new Map<string, ServiceOption[]>();
  for (const service of services) {
    const key = service.categoryName ?? "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), service]);
  }

  return (
    <form action={action}>
      <input type="hidden" name="staffId" value={staffId} />

      {state?.error && (
        <p role="alert" className="mb-3 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mb-3 text-[14px] text-moss">
          {state.message}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {[...byCategory].map(([category, items]) => (
          <fieldset key={category}>
            <legend className="mb-2 text-[12px] tracking-[0.08em] text-sage uppercase">
              {category}
            </legend>
            <div className="grid gap-1.5">
              {items.map((service) => (
                <label
                  key={service.id}
                  className="flex cursor-pointer items-center gap-2.5 text-[14px]"
                >
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    defaultChecked={selected.includes(service.id)}
                    className="h-[16px] w-[16px] accent-ink"
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <Button type="submit" className="mt-5" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save services"}
      </Button>
    </form>
  );
}

function RetireForm({ staffId, name }: { staffId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<StaffResult | null, FormData>(
    retireStaffAction,
    null,
  );

  return (
    <div>
      <h4 className="mb-1 text-[15px] font-semibold">Retire</h4>
      <p className="mb-3 text-[13px] leading-[1.6] text-muted">
        Removes them from the site and from booking. Past appointments, notes
        and takings are kept.
      </p>

      {state?.error && (
        <p role="alert" className="mb-3 max-w-[520px] text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mb-3 text-[14px] text-moss">
          {state.message}
        </p>
      )}

      {confirming ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="staffId" value={staffId} />
          <span className="text-[13px] text-muted">Retire {name}?</span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Retiring…" : "Yes, retire"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Retire {name.split(" ")[0]}
        </Button>
      )}
    </div>
  );
}
