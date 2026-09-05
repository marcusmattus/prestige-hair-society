"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  saveOpeningHoursAction,
  type AvailabilityResult,
} from "@/lib/studio/availability-actions";

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type DayHours = {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

const TIME_INPUT =
  "min-h-[40px] rounded-[4px] border border-line bg-white px-2 py-1.5 text-[14px] disabled:bg-sand disabled:text-muted";

export function OpeningHoursForm({ days }: { days: DayHours[] }) {
  const [state, action, pending] = useActionState<AvailabilityResult | null, FormData>(
    saveOpeningHoursAction,
    null,
  );

  // Closed days grey out their time inputs, so the row reads as one decision.
  const [closed, setClosed] = useState<Record<number, boolean>>(
    Object.fromEntries(days.map((d) => [d.dayOfWeek, d.isClosed])),
  );

  return (
    <form action={action}>
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

      <div className="overflow-x-auto rounded-[6px] border border-line">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12px] tracking-[0.08em] text-sage uppercase">
              <th className="px-4 py-3 font-normal">Day</th>
              <th className="px-4 py-3 font-normal">Open</th>
              <th className="px-4 py-3 font-normal">From</th>
              <th className="px-4 py-3 font-normal">Until</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const isClosed = closed[day.dayOfWeek] ?? day.isClosed;
              return (
                <tr key={day.dayOfWeek} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{DAY_NAMES[day.dayOfWeek - 1]}</td>
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name={`closed.${day.dayOfWeek}`}
                        defaultChecked={day.isClosed}
                        onChange={(e) =>
                          setClosed((c) => ({ ...c, [day.dayOfWeek]: e.target.checked }))
                        }
                        className="h-[18px] w-[18px] accent-ink"
                      />
                      <span className="text-[13px] text-muted">
                        {isClosed ? "Closed" : "Open"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="time"
                      name={`opens.${day.dayOfWeek}`}
                      defaultValue={day.opensAt}
                      disabled={isClosed}
                      aria-label={`${DAY_NAMES[day.dayOfWeek - 1]} opening time`}
                      className={TIME_INPUT}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="time"
                      name={`closes.${day.dayOfWeek}`}
                      defaultValue={day.closesAt}
                      disabled={isClosed}
                      aria-label={`${DAY_NAMES[day.dayOfWeek - 1]} closing time`}
                      className={TIME_INPUT}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] leading-[1.6] text-muted">
        The checkbox marks the day closed. Times are ignored on a closed day, so
        they are kept rather than cleared — reopening restores them.
      </p>

      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Saving…" : "Save opening hours"}
      </Button>
    </form>
  );
}
