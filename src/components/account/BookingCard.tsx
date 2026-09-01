"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AddToCalendar } from "@/components/booking/AddToCalendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cancelBookingAction, type ActionResult } from "@/lib/bookings/actions";
import { balanceDue, formatPence } from "@/lib/money";
import { formatWhenLong, isWithinPolicyWindow } from "@/lib/time";
import { cn } from "@/lib/utils";

type BookingRow = {
  id: string;
  reference: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_price_pence: number;
  deposit_pence: number;
  deposit_paid_pence: number;
  balance_paid_pence: number;
  pricing_mode: string;
  customer_notes: string | null;
  service: { name: string; slug: string; preparation_instructions: string | null } | null;
  staff: { display_name: string; slug: string } | null;
  salon: {
    timezone: string;
    cancellation_window_hours: number;
    reschedule_window_hours: number;
    address_line1: string;
    city: string;
    postcode: string;
    google_maps_url: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled_by_customer: "Cancelled by you",
  cancelled_by_salon: "Cancelled by the salon",
  no_show: "Missed",
};

export function BookingCard({
  booking,
  upcoming,
}: {
  booking: BookingRow;
  upcoming: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, cancelAction, pending] = useActionState<ActionResult | null, FormData>(
    cancelBookingAction,
    null,
  );

  const tz = booking.salon?.timezone ?? "Europe/London";
  const cancelWindow = booking.salon?.cancellation_window_hours ?? 24;
  const rescheduleWindow = booking.salon?.reschedule_window_hours ?? 24;

  const canCancel = upcoming && isWithinPolicyWindow(booking.starts_at, cancelWindow);
  const canReschedule = upcoming && isWithinPolicyWindow(booking.starts_at, rescheduleWindow);
  const insideWindow = upcoming && !canCancel;

  const outstanding = balanceDue(
    booking.total_price_pence,
    booking.deposit_paid_pence,
    booking.balance_paid_pence,
  );
  const address = booking.salon
    ? `${booking.salon.address_line1}, ${booking.salon.city} ${booking.salon.postcode}`
    : "";

  return (
    <article
      className={cn(
        "rounded-[6px] border px-6 py-6",
        upcoming ? "border-line bg-cream" : "border-line bg-cream/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-[24px]">{booking.service?.name ?? "Appointment"}</h3>
          <p className="mt-1 text-[15px] text-muted">
            {formatWhenLong(booking.starts_at, tz)}
          </p>
          <p className="mt-0.5 text-[14px] text-muted">
            with {booking.staff?.display_name ?? "one of our stylists"} · {booking.reference}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-[3px] border px-2.5 py-1 text-[12px] tracking-[0.06em] uppercase",
            booking.status === "confirmed"
              ? "border-moss text-moss"
              : booking.status.startsWith("cancelled") || booking.status === "no_show"
                ? "border-line text-muted"
                : "border-gold text-gold",
          )}
        >
          {STATUS_LABELS[booking.status] ?? booking.status}
        </span>
      </div>

      <dl className="mt-5 grid gap-2 border-t border-line pt-4 text-[14px] sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted">Deposit paid</dt>
          <dd className="sm:mt-0.5">{formatPence(booking.deposit_paid_pence)}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted">Balance in salon</dt>
          <dd className="sm:mt-0.5">
            {formatPence(outstanding)}
            {booking.pricing_mode === "from" && " onwards"}
          </dd>
        </div>
      </dl>

      {upcoming && booking.service?.preparation_instructions && (
        <p className="mt-4 rounded-[4px] bg-sand px-4 py-3 text-[13px] leading-[1.6] text-muted">
          <span className="text-ink">Before you come: </span>
          {booking.service.preparation_instructions}
        </p>
      )}

      {state?.error && (
        <p role="alert" className="mt-4 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mt-4 text-[14px] text-moss">
          {state.message}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {upcoming && (
          <AddToCalendar
            title={booking.service?.name ?? "Appointment"}
            startsAt={booking.starts_at}
            endsAt={booking.ends_at}
            location={address}
            description={`Reference ${booking.reference}.`}
          />
        )}

        {canReschedule && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/account/bookings/${booking.id}/reschedule`}>Reschedule</Link>
          </Button>
        )}

        {!upcoming && booking.service && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/book?service=${booking.service.slug}`}>Book this again</Link>
          </Button>
        )}

        {canCancel && !confirming && (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
      </div>

      {/* The consequences are stated before the customer commits, not after. */}
      {confirming && (
        <form action={cancelAction} className="mt-5 rounded-[6px] border border-line bg-sand p-5">
          <input type="hidden" name="bookingId" value={booking.id} />

          <h4 className="mb-2 font-serif text-[20px]">Cancel this appointment?</h4>
          <p className="mb-4 text-[14px] leading-[1.7] text-muted">
            {booking.deposit_paid_pence === 0
              ? "No deposit was taken, so there is nothing to refund."
              : `Your ${formatPence(booking.deposit_paid_pence)} deposit will be refunded within five working days, because you are cancelling more than ${cancelWindow} hours ahead.`}{" "}
            The slot will be released immediately.
          </p>

          <label htmlFor={`reason-${booking.id}`} className="mb-1.5 block text-[13px] text-muted">
            Anything we should know? (optional)
          </label>
          <Textarea id={`reason-${booking.id}`} name="reason" rows={2} className="mb-4" />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" size="sm" disabled={pending}>
              {pending ? "Cancelling…" : "Yes, cancel it"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep my appointment
            </Button>
          </div>
        </form>
      )}

      {insideWindow && (
        <p className="mt-4 text-[13px] leading-[1.6] text-muted">
          This appointment is within {cancelWindow} hours, so it can no longer be
          changed here. Please call the salon.
        </p>
      )}
    </article>
  );
}
