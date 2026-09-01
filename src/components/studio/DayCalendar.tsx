"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { balanceDue, formatPence } from "@/lib/money";
import { formatDateLong, formatTime, inZone, toSalonDate } from "@/lib/time";
import { cn } from "@/lib/utils";

type StaffRow = { id: string; display_name: string; title: string | null };

type BookingRow = {
  id: string;
  reference: string;
  status: string;
  starts_at: string;
  ends_at: string;
  blocked_until: string;
  staff_id: string;
  internal_notes: string | null;
  total_price_pence: number;
  deposit_paid_pence: number;
  balance_paid_pence: number;
  service: { name: string } | null;
  profile: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

type BreakRow = {
  staff_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  label: string | null;
};

type TimeOffRow = {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

/** Pixels per minute. 1.1 keeps a 30-minute service comfortably readable. */
const PX_PER_MINUTE = 1.1;

export function DayCalendar({
  date,
  view,
  timezone,
  staff,
  bookings,
  breaks,
  timeOff,
  opensAt,
  closesAt,
  isClosed,
  closureReason,
}: {
  date: string;
  view: "day" | "week";
  timezone: string;
  staff: StaffRow[];
  bookings: BookingRow[];
  breaks: BreakRow[];
  timeOff: TimeOffRow[];
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  closureReason: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<BookingRow | null>(null);

  const openMinutes = toMinutes(opensAt);
  const closeMinutes = toMinutes(closesAt);
  const totalMinutes = Math.max(60, closeMinutes - openMinutes);
  const gridHeight = totalMinutes * PX_PER_MINUTE;

  const isoWeekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const dayBookings = bookings.filter((b) => toSalonDate(b.starts_at, timezone) === date);

  function goTo(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", nextDate);
    router.push(`/studio/calendar?${params}`);
  }

  const hourMarks: number[] = [];
  for (let m = Math.ceil(openMinutes / 60) * 60; m <= closeMinutes; m += 60) {
    hourMarks.push(m);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Calendar</h1>
          <p className="mt-1 text-[14px] text-muted">
            {formatDateLong(`${date}T12:00:00Z`, timezone)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => goTo(shiftDate(date, -1))}>
            ← Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => goTo(toSalonDate(new Date(), timezone))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => goTo(shiftDate(date, 1))}>
            Next →
          </Button>
          <label htmlFor="cal-date" className="sr-only">
            Jump to date
          </label>
          <input
            id="cal-date"
            type="date"
            value={date}
            onChange={(e) => goTo(e.target.value)}
            className="min-h-[44px] rounded-[4px] border border-line bg-white px-3 text-[14px]"
          />
        </div>
      </div>

      {isClosed ? (
        <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] text-muted">
          The salon is closed on this date{closureReason ? ` — ${closureReason}` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-line bg-cream">
          <div
            className="grid min-w-[900px]"
            style={{ gridTemplateColumns: `64px repeat(${staff.length}, minmax(160px, 1fr))` }}
          >
            {/* Column headings */}
            <div className="sticky left-0 z-10 border-r border-b border-line bg-sand" />
            {staff.map((person) => (
              <div
                key={person.id}
                className="border-b border-line bg-sand px-3 py-3 text-center"
              >
                <div className="text-[14px]">{person.display_name}</div>
                {person.title && (
                  <div className="text-[12px] text-muted">{person.title}</div>
                )}
              </div>
            ))}

            {/* Hour gutter */}
            <div
              className="sticky left-0 z-10 border-r border-line bg-cream"
              style={{ height: gridHeight }}
            >
              {hourMarks.map((m) => (
                <div
                  key={m}
                  className="absolute -translate-y-1/2 pr-2 text-right text-[12px] text-muted"
                  style={{ top: (m - openMinutes) * PX_PER_MINUTE, width: 64 }}
                >
                  {String(Math.floor(m / 60)).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* One column per stylist */}
            {staff.map((person) => {
              const columnBookings = dayBookings.filter((b) => b.staff_id === person.id);
              const columnBreaks = breaks.filter(
                (b) => b.staff_id === person.id && b.day_of_week === isoWeekday,
              );
              const columnTimeOff = timeOff.filter((t) => t.staff_id === person.id);

              return (
                <div
                  key={person.id}
                  className="relative border-r border-line last:border-r-0"
                  style={{ height: gridHeight }}
                >
                  {hourMarks.map((m) => (
                    <div
                      key={m}
                      className="absolute right-0 left-0 border-t border-line/60"
                      style={{ top: (m - openMinutes) * PX_PER_MINUTE }}
                    />
                  ))}

                  {columnBreaks.map((brk, i) => (
                    <div
                      key={`break-${i}`}
                      className="absolute right-1 left-1 rounded-[3px] bg-[repeating-linear-gradient(135deg,#EDE7DA_0_6px,#E6DFCE_6px_12px)] px-2 py-1 text-[11px] text-muted"
                      style={{
                        top: (toMinutes(brk.starts_at) - openMinutes) * PX_PER_MINUTE,
                        height:
                          (toMinutes(brk.ends_at) - toMinutes(brk.starts_at)) * PX_PER_MINUTE,
                      }}
                    >
                      {brk.label ?? "Break"}
                    </div>
                  ))}

                  {columnTimeOff.map((off, i) => {
                    const from = Math.max(openMinutes, localMinutes(off.starts_at, timezone, date));
                    const to = Math.min(closeMinutes, localMinutes(off.ends_at, timezone, date, true));
                    if (to <= from) return null;
                    return (
                      <div
                        key={`off-${i}`}
                        className="absolute right-1 left-1 rounded-[3px] border border-line bg-line/30 px-2 py-1 text-[11px] text-muted"
                        style={{
                          top: (from - openMinutes) * PX_PER_MINUTE,
                          height: (to - from) * PX_PER_MINUTE,
                        }}
                      >
                        {off.reason ?? "Time off"}
                      </div>
                    );
                  })}

                  {columnBookings.map((booking) => {
                    const from = localMinutes(booking.starts_at, timezone, date);
                    const to = localMinutes(booking.ends_at, timezone, date, true);
                    const bufferTo = localMinutes(booking.blocked_until, timezone, date, true);

                    return (
                      <div key={booking.id}>
                        {/* Buffer tail, so staff can see the chair is not free yet. */}
                        {bufferTo > to && (
                          <div
                            className="absolute right-1 left-1 rounded-b-[3px] border-x border-b border-dashed border-line"
                            style={{
                              top: (to - openMinutes) * PX_PER_MINUTE,
                              height: (bufferTo - to) * PX_PER_MINUTE,
                            }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelected(booking)}
                          className={cn(
                            "absolute right-1 left-1 cursor-pointer overflow-hidden rounded-[3px] border px-2 py-1 text-left text-[12px] transition-colors",
                            booking.status === "confirmed" &&
                              "border-ink bg-ink text-sand hover:bg-ink-hover",
                            booking.status === "pending_payment" &&
                              "border-gold bg-gold/15 text-ink hover:bg-gold/25",
                            booking.status === "completed" &&
                              "border-moss bg-moss/15 text-ink",
                            booking.status === "no_show" &&
                              "border-line bg-line/40 text-muted line-through",
                          )}
                          style={{
                            top: (from - openMinutes) * PX_PER_MINUTE,
                            height: Math.max(22, (to - from) * PX_PER_MINUTE),
                          }}
                        >
                          <span className="block truncate font-medium">
                            {booking.profile
                              ? `${booking.profile.first_name} ${booking.profile.last_name}`.trim()
                              : "Client"}
                          </span>
                          <span className="block truncate opacity-80">
                            {booking.service?.name}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-[13px] text-muted">
        Select an appointment to see its details. Dragging to reschedule is not
        wired up yet — use the reschedule action in the panel.
      </p>

      {selected && (
        <BookingPanel
          booking={selected}
          timezone={timezone}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BookingPanel({
  booking,
  timezone,
  onClose,
}: {
  booking: BookingRow;
  timezone: string;
  onClose: () => void;
}) {
  const outstanding = balanceDue(
    booking.total_price_pence,
    booking.deposit_paid_pence,
    booking.balance_paid_pence,
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(33,49,38,0.34)]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Appointment details"
        className="relative h-full w-[420px] max-w-full overflow-y-auto bg-cream p-6 shadow-[-24px_0_60px_rgba(33,49,38,0.18)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[24px]">{booking.service?.name}</h2>
            <p className="mt-1 text-[14px] text-muted">{booking.reference}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-[18px] text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        <dl className="grid gap-3 border-t border-line pt-4 text-[14px]">
          <Row label="Client">
            {booking.profile ? (
              <Link
                href={`/studio/clients/${booking.profile.id}`}
                className="underline underline-offset-2"
              >
                {`${booking.profile.first_name} ${booking.profile.last_name}`.trim()}
              </Link>
            ) : (
              "—"
            )}
          </Row>
          {booking.profile?.phone && <Row label="Phone">{booking.profile.phone}</Row>}
          <Row label="When">
            {formatTime(booking.starts_at, timezone)}–{formatTime(booking.ends_at, timezone)}
          </Row>
          <Row label="Status">
            <span className="capitalize">{booking.status.replace(/_/g, " ")}</span>
          </Row>
          <Row label="Total">{formatPence(booking.total_price_pence)}</Row>
          <Row label="Deposit">{formatPence(booking.deposit_paid_pence)}</Row>
          <Row label="Due in salon">{formatPence(outstanding)}</Row>
        </dl>

        {booking.internal_notes && (
          <div className="mt-5 rounded-[6px] border border-line bg-sand px-4 py-3">
            <div className="mb-1 text-[12px] tracking-[0.12em] text-sage uppercase">
              Internal note
            </div>
            <p className="text-[14px] leading-[1.6]">{booking.internal_notes}</p>
          </div>
        )}

        <div className="mt-6 grid gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/studio/bookings/${booking.id}`}>Open full record</Link>
          </Button>
          {booking.profile && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/studio/clients/${booking.profile.id}`}>View client</Link>
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** "13:45:00" -> 825 */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Minutes past salon-local midnight on `date`. An instant before that day
 * clamps to 0 and one after clamps to the end, so a multi-day block (time off
 * spanning a week) draws correctly on each day it covers.
 */
function localMinutes(
  instant: string,
  timezone: string,
  date: string,
  isEnd = false,
): number {
  const local = inZone(instant, timezone);
  const day = toSalonDate(instant, timezone);
  if (day < date) return 0;
  if (day > date) return isEnd ? 24 * 60 : 24 * 60;
  return local.getHours() * 60 + local.getMinutes();
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
