"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DAY_NAMES } from "@/components/studio/OpeningHoursForm";
import {
  saveStaffScheduleAction,
  type AvailabilityResult,
} from "@/lib/studio/availability-actions";

export type RosterDay = {
  dayOfWeek: number;
  working: boolean;
  startsAt: string;
  endsAt: string;
  breakStart: string;
  breakEnd: string;
};

const TIME_INPUT =
  "min-h-[40px] w-full rounded-[4px] border border-line bg-white px-2 py-1.5 text-[14px] disabled:bg-sand disabled:text-muted";

export function RosterForm({
  staffId,
  staffName,
  days,
}: {
  staffId: string;
  staffName: string;
  days: RosterDay[];
}) {
  const [state, action, pending] = useActionState<AvailabilityResult | null, FormData>(
    saveStaffScheduleAction,
    null,
  );

  const [working, setWorking] = useState<Record<number, boolean>>(
    Object.fromEntries(days.map((d) => [d.dayOfWeek, d.working])),
  );

  return (
    <form action={action}>
      <input type="hidden" name="staffId" value={staffId} />

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
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12px] tracking-[0.08em] text-sage uppercase">
              <th className="px-3 py-3 font-normal">Day</th>
              <th className="px-3 py-3 font-normal">Working</th>
              <th className="px-3 py-3 font-normal">Start</th>
              <th className="px-3 py-3 font-normal">Finish</th>
              <th className="px-3 py-3 font-normal">Break from</th>
              <th className="px-3 py-3 font-normal">Break until</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const isWorking = working[day.dayOfWeek] ?? day.working;
              const label = DAY_NAMES[day.dayOfWeek - 1];
              return (
                <tr key={day.dayOfWeek} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 whitespace-nowrap">{label}</td>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      name={`working.${day.dayOfWeek}`}
                      defaultChecked={day.working}
                      onChange={(e) =>
                        setWorking((w) => ({ ...w, [day.dayOfWeek]: e.target.checked }))
                      }
                      aria-label={`${staffName} works ${label}`}
                      className="h-[18px] w-[18px] accent-ink"
                    />
                  </td>
                  {(
                    [
                      ["start", day.startsAt, "start"],
                      ["end", day.endsAt, "finish"],
                      ["breakStart", day.breakStart, "break start"],
                      ["breakEnd", day.breakEnd, "break end"],
                    ] as const
                  ).map(([field, value, description]) => (
                    <td key={field} className="px-3 py-3">
                      <input
                        type="time"
                        name={`${field}.${day.dayOfWeek}`}
                        defaultValue={value}
                        disabled={!isWorking}
                        aria-label={`${label} ${description}`}
                        className={TIME_INPUT}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] leading-[1.6] text-muted">
        A shift outside the salon&rsquo;s opening hours has no effect — the two
        are intersected, so the narrower one wins. Leave both break fields empty
        for no break.
      </p>

      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Saving…" : `Save ${staffName.split(" ")[0]}'s week`}
      </Button>
    </form>
  );
}
