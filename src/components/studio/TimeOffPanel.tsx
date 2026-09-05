"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  addTimeOffAction,
  deleteTimeOffAction,
  saveBlockedDateAction,
  deleteBlockedDateAction,
  type AvailabilityResult,
} from "@/lib/studio/availability-actions";

const FIELD =
  "min-h-[44px] w-full rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]";

export type TimeOffEntry = {
  id: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  formatted: string;
};

export type BlockedDateEntry = {
  id: string;
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string | null;
};

export function TimeOffPanel({
  staff,
  entries,
}: {
  staff: { id: string; name: string }[];
  entries: TimeOffEntry[];
}) {
  const [state, action, pending] = useActionState<AvailabilityResult | null, FormData>(
    addTimeOffAction,
    null,
  );
  const [removeState, removeAction] = useActionState<AvailabilityResult | null, FormData>(
    deleteTimeOffAction,
    null,
  );

  return (
    <div>
      <form action={action} className="mb-6 rounded-[6px] border border-line px-5 py-5">
        {state?.error && (
          <p role="alert" className="mb-4 text-[14px] text-[#B4483C]">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="mb-4 text-[14px] text-moss">
            {state.message}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Stylist
            </span>
            <select name="staffId" required className={FIELD}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Reason (optional)
            </span>
            <input name="reason" placeholder="Holiday, training…" className={FIELD} />
          </label>

          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              From
            </span>
            <input type="datetime-local" name="startsAt" required className={FIELD} />
          </label>

          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Until
            </span>
            <input type="datetime-local" name="endsAt" required className={FIELD} />
          </label>
        </div>

        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? "Recording…" : "Record time off"}
        </Button>
      </form>

      {removeState?.message && (
        <p role="status" className="mb-4 text-[14px] text-moss">
          {removeState.message}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-[15px] text-muted">No time off recorded.</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line px-5 py-3"
            >
              <span className="text-[14px]">
                <strong className="font-medium">{entry.staffName}</strong>
                <span className="ml-2 text-muted">{entry.formatted}</span>
                {entry.reason && (
                  <span className="ml-2 text-[13px] text-muted">· {entry.reason}</span>
                )}
              </span>
              <form action={removeAction}>
                <input type="hidden" name="id" value={entry.id} />
                <Button type="submit" size="sm" variant="outline">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClosuresPanel({ entries }: { entries: BlockedDateEntry[] }) {
  const [state, action, pending] = useActionState<AvailabilityResult | null, FormData>(
    saveBlockedDateAction,
    null,
  );
  const [removeState, removeAction] = useActionState<AvailabilityResult | null, FormData>(
    deleteBlockedDateAction,
    null,
  );

  return (
    <div>
      <form action={action} className="mb-6 rounded-[6px] border border-line px-5 py-5">
        {state?.error && (
          <p role="alert" className="mb-4 text-[14px] text-[#B4483C]">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="mb-4 text-[14px] text-moss">
            {state.message}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Date
            </span>
            <input type="date" name="date" required className={FIELD} />
          </label>

          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Reason (optional)
            </span>
            <input name="reason" placeholder="Bank holiday, private event…" className={FIELD} />
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[6px] border border-line px-4 py-3">
          <input
            type="checkbox"
            name="isClosed"
            defaultChecked
            className="mt-0.5 h-[18px] w-[18px] accent-ink"
          />
          <span>
            <span className="block text-[15px]">Closed all day</span>
            <span className="block text-[13px] text-muted">
              Untick to open with different hours instead, and set them below.
            </span>
          </span>
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Special opening
            </span>
            <input type="time" name="opensAt" className={FIELD} />
          </label>
          <label className="text-[13px]">
            <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
              Special closing
            </span>
            <input type="time" name="closesAt" className={FIELD} />
          </label>
        </div>

        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? "Saving…" : "Save date"}
        </Button>
      </form>

      {removeState?.message && (
        <p role="status" className="mb-4 text-[14px] text-moss">
          {removeState.message}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-[15px] text-muted">
          No closures or special hours. Normal opening hours apply every day.
        </p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line px-5 py-3"
            >
              <span className="text-[14px]">
                <strong className="font-medium">{entry.date}</strong>
                <span className="ml-2 text-muted">
                  {entry.isClosed
                    ? "Closed all day"
                    : `${entry.opensAt?.slice(0, 5)} – ${entry.closesAt?.slice(0, 5)}`}
                </span>
                {entry.reason && (
                  <span className="ml-2 text-[13px] text-muted">· {entry.reason}</span>
                )}
              </span>
              <form action={removeAction}>
                <input type="hidden" name="id" value={entry.id} />
                <Button type="submit" size="sm" variant="outline">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
