"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AvailableSlot } from "@/lib/salon";
import {
  DEFAULT_TIMEZONE,
  formatDayMonth,
  formatRelativeDay,
  formatTime,
  timeOfDay,
  toSalonDate,
  upcomingSalonDates,
  type TimeOfDay,
} from "@/lib/time";
import { cn } from "@/lib/utils";

const FILTERS: { id: TimeOfDay | "all"; label: string }[] = [
  { id: "all", label: "All day" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];

/**
 * Date and time selection.
 *
 * Fetches a fortnight at a time so the date strip can grey out days with
 * nothing free, rather than making the customer click each one to find out.
 */
export function DateTimeStep({
  serviceId,
  staffId,
  addonIds,
  bookingWindowDays,
  timezone,
  selectedSlot,
  onSelectSlot,
}: {
  serviceId: string;
  staffId: string | null;
  addonIds: string[];
  bookingWindowDays: number;
  timezone: string;
  selectedSlot: string | null;
  onSelectSlot: (startsAt: string, staffId: string) => void;
}) {
  const days = useMemo(
    () => upcomingSalonDates(Math.min(bookingWindowDays, 28), timezone),
    [bookingWindowDays, timezone],
  );

  // One string identifies the request. Deriving "loading" from whether the
  // stored result matches it means no state has to be reset in an effect, and
  // the array of add-on ids cannot retrigger the fetch by identity alone.
  const requestKey = [
    serviceId,
    staffId ?? "any",
    [...addonIds].sort().join(","),
    days[0],
    days[days.length - 1],
  ].join("|");

  const [result, setResult] = useState<{
    key: string;
    slots: AvailableSlot[];
    error: string | null;
  } | null>(null);

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimeOfDay | "all">("all");

  const loaded = result?.key === requestKey ? result : null;
  const slots = loaded?.slots ?? null;
  const error = loaded?.error ?? null;

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      serviceId,
      from: days[0],
      to: days[days.length - 1],
    });
    if (staffId) params.set("staffId", staffId);
    for (const id of addonIds) params.append("addonIds", id);

    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { slots: AvailableSlot[] }) =>
        setResult({ key: requestKey, slots: data.slots, error: null }),
      )
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setResult({
          key: requestKey,
          slots: [],
          error: "We could not load availability. Please try again.",
        });
      });

    return () => controller.abort();
    // requestKey encodes every input; days is derived from props above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Group by salon-local day so the strip and the slot list agree.
  const byDay = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const slot of slots ?? []) {
      const day = toSalonDate(slot.slot_start, timezone);
      const list = map.get(day) ?? [];
      list.push(slot);
      map.set(day, list);
    }
    return map;
  }, [slots, timezone]);

  const firstAvailableDay = useMemo(
    () => days.find((d) => (byDay.get(d)?.length ?? 0) > 0) ?? null,
    [days, byDay],
  );

  // Land the customer on the first day with something free, without copying it
  // into state: until they pick a day themselves, the first available one is
  // the selected one.
  const selectedDay = pickedDay ?? firstAvailableDay;

  const daySlots = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const filtered =
    filter === "all"
      ? daySlots
      : daySlots.filter((s) => timeOfDay(s.slot_start, timezone) === filter);

  // When "any stylist" is chosen, several stylists may offer the same minute.
  // Show each time once and book whoever is free.
  const uniqueTimes = useMemo(() => {
    const seen = new Map<string, AvailableSlot>();
    for (const slot of filtered) {
      if (!seen.has(slot.slot_start)) seen.set(slot.slot_start, slot);
    }
    return [...seen.values()].sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  }, [filtered]);

  return (
    <div>
      <h2 className="mb-1 font-serif text-[30px] font-light md:text-[36px]">
        When suits you?
      </h2>
      <p className="mb-6 text-[15px] text-muted">
        Times are shown in {timezone === DEFAULT_TIMEZONE ? "London time" : timezone}.
      </p>

      {firstAvailableDay && selectedDay !== firstAvailableDay && (
        <Button
          variant="quiet"
          size="sm"
          className="mb-4 !px-0"
          onClick={() => setPickedDay(firstAvailableDay)}
        >
          Jump to first available — {formatRelativeDay(`${firstAvailableDay}T12:00:00Z`, timezone)}{" "}
          {formatDayMonth(`${firstAvailableDay}T12:00:00Z`, timezone)} →
        </Button>
      )}

      <div
        role="group"
        aria-label="Choose a date"
        className="mb-6 flex gap-2 overflow-x-auto pb-2"
      >
        {days.map((day) => {
          const count = byDay.get(day)?.length ?? 0;
          const disabled = slots !== null && count === 0;
          const active = day === selectedDay;
          const iso = `${day}T12:00:00Z`;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => setPickedDay(day)}
              aria-pressed={active}
              aria-label={`${formatRelativeDay(iso, timezone)} ${formatDayMonth(iso, timezone)}${
                disabled ? ", nothing available" : ""
              }`}
              className={cn(
                "min-h-[64px] w-[76px] shrink-0 cursor-pointer rounded-[4px] border px-2 py-2.5 text-center transition-colors",
                active
                  ? "border-ink bg-ink text-sand"
                  : "border-line bg-cream text-ink hover:border-gold",
                disabled && "cursor-not-allowed opacity-35 hover:border-line",
              )}
            >
              <span className="block text-[11px] tracking-[0.06em] uppercase opacity-70">
                {formatRelativeDay(iso, timezone)}
              </span>
              <span className="mt-1 block text-[14px]">{formatDayMonth(iso, timezone)}</span>
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Filter by time of day" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "min-h-[44px] cursor-pointer rounded-[4px] border px-4 py-2 text-[13px] transition-colors",
              filter === f.id
                ? "border-ink bg-ink text-sand"
                : "border-line text-ink hover:border-gold",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-atomic="false">
        {slots === null && (
          <p className="py-8 text-center text-[14px] text-muted">Loading availability…</p>
        )}

        {error && (
          <p role="alert" className="py-4 text-[14px] text-[#B4483C]">
            {error}
          </p>
        )}

        {slots !== null && !error && uniqueTimes.length === 0 && (
          <div className="rounded-[6px] border border-line bg-sand px-5 py-6 text-center">
            <p className="mb-1 text-[15px] text-ink">Nothing free here.</p>
            <p className="text-[14px] text-muted">
              Try another day or filter — or join the waiting list and we will
              tell you the moment something opens up.
            </p>
          </div>
        )}

        {uniqueTimes.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {uniqueTimes.map((slot) => {
              const active = slot.slot_start === selectedSlot;
              return (
                <li key={slot.slot_start}>
                  <button
                    type="button"
                    onClick={() => onSelectSlot(slot.slot_start, slot.staff_id)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-[46px] w-full cursor-pointer rounded-[4px] border px-2 py-3 text-[14px] transition-colors",
                      active
                        ? "border-ink bg-ink text-sand"
                        : "border-line bg-cream text-ink hover:border-gold",
                    )}
                  >
                    {formatTime(slot.slot_start, timezone)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!staffId && uniqueTimes.length > 0 && (
        <p className="mt-5 text-[13px] leading-[1.6] text-muted">
          Your stylist is confirmed when you continue.
        </p>
      )}
    </div>
  );
}
