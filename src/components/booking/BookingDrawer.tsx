"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  SERVICES,
  STYLISTS,
  TIMES,
  bookingReference,
  formatDayMonth,
  formatFullDate,
  formatPrice,
  formatWeekday,
  getService,
  upcomingDates,
} from "@/lib/booking";
import { useBooking } from "./BookingProvider";

const FIELD =
  "rounded-[4px] border border-line bg-white px-3.5 py-[13px] text-[14px] text-ink min-h-[46px] focus:border-gold focus:outline-none";

/** Selectable pill — dark when active, outlined when not. */
function Chip({
  active,
  onClick,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[46px] cursor-pointer rounded-[4px] border px-2 py-3 text-center text-[13px] transition-colors ${
        active
          ? "border-ink bg-ink text-sand"
          : "border-line bg-cream text-ink hover:border-gold"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function BookingDrawer() {
  const {
    state,
    closeBooking,
    next,
    back,
    setService,
    setStylist,
    setDateIdx,
    setTime,
    setDetail,
  } = useBooking();
  const { step, serviceId, stylist, dateIdx, time, details } = state;

  const panelRef = useRef<HTMLElement>(null);
  const dates = useMemo(() => upcomingDates(10), []);
  const service = getService(serviceId);
  const selectedDate = dates[dateIdx] ?? dates[0];

  // Lock the page behind the drawer and close on Escape.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBooking();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeBooking]);

  const summaryLine = `${service.name} · ${formatFullDate(selectedDate)} · ${time}`;
  const balance = service.price - service.deposit;

  const detailsComplete =
    details.first.trim() !== "" &&
    details.last.trim() !== "" &&
    details.email.trim() !== "" &&
    details.phone.trim() !== "" &&
    details.agreed;
  const canContinue = step !== 3 || detailsComplete;

  const stepMeta = [
    { label: "Service", on: true },
    { label: "Date & time", on: step >= 2 },
    { label: "Details", on: step >= 3 },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        onClick={closeBooking}
        aria-hidden="true"
        className="absolute inset-0 animate-veil bg-[rgba(33,49,38,0.34)]"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your appointment"
        tabIndex={-1}
        className="relative h-full w-[480px] max-w-full animate-slide-in overflow-y-auto bg-cream shadow-[-24px_0_60px_rgba(33,49,38,0.18)] focus:outline-none"
      >
        <div className="sticky top-0 z-2 border-b border-line bg-cream px-5 pt-[22px] pb-[18px] sm:px-[30px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              aria-label="Back"
              className="h-8 w-8 cursor-pointer text-[18px] text-muted transition-colors hover:text-ink disabled:cursor-default disabled:opacity-30"
            >
              ←
            </button>
            <div className="font-serif text-[24px]">Your appointment</div>
            <button
              type="button"
              onClick={closeBooking}
              aria-label="Close booking"
              className="h-8 w-8 cursor-pointer text-[18px] text-muted transition-colors hover:text-ink"
            >
              ✕
            </button>
          </div>

          <ol className="mt-5 grid grid-cols-3 gap-2">
            {stepMeta.map(({ label, on }) => (
              <li key={label} className="text-center">
                <div
                  className={`h-[2px] rounded-[2px] ${on ? "bg-ink" : "bg-line"}`}
                />
                <div
                  className={`mt-2 text-[11px] tracking-[0.1em] uppercase ${
                    on ? "text-ink" : "text-sage"
                  }`}
                >
                  {label}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-5 pt-[26px] pb-10 sm:px-[30px]">
          {step === 1 && (
            <div>
              <div className="mb-4 text-[13px] tracking-[0.12em] text-sage uppercase">
                Choose a service
              </div>
              <div className="grid gap-2.5">
                {SERVICES.map((s) => {
                  const active = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setService(s.id)}
                      aria-pressed={active}
                      className={`w-full cursor-pointer rounded-[6px] border px-[18px] py-4 text-left transition-colors ${
                        active
                          ? "border-ink bg-sand"
                          : "border-line bg-cream hover:border-gold"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-serif text-[21px]">{s.name}</span>
                        <span className="text-[13px] text-moss">
                          {formatPrice(s)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12px] text-muted">
                        {s.mins} min · £{s.deposit} deposit
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 mb-3.5 text-[13px] tracking-[0.12em] text-sage uppercase">
                Stylist
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {STYLISTS.map((name) => (
                  <Chip
                    key={name}
                    active={name === stylist}
                    onClick={() => setStylist(name)}
                  >
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-4 text-[13px] tracking-[0.12em] text-sage uppercase">
                Choose a date
              </div>
              <div className="grid grid-cols-5 gap-2">
                {dates.map((d, i) => (
                  <Chip
                    key={d.toISOString()}
                    active={i === dateIdx}
                    onClick={() => setDateIdx(i)}
                    className="!px-1 !py-2.5"
                  >
                    <span className="block text-[11px] tracking-[0.06em] uppercase opacity-70">
                      {i === 0 ? "Today" : formatWeekday(d)}
                    </span>
                    <span className="mt-1 block text-[14px]">
                      {formatDayMonth(d)}
                    </span>
                  </Chip>
                ))}
              </div>

              <div className="mt-7 mb-3.5 text-[13px] tracking-[0.12em] text-sage uppercase">
                Choose a time
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIMES.map((t) => (
                  <Chip key={t} active={t === time} onClick={() => setTime(t)}>
                    {t}
                  </Chip>
                ))}
              </div>

              <p className="mt-6 rounded-[6px] border border-line bg-sand px-[18px] py-4 text-[13px] leading-[1.6] text-muted">
                Times are shown in Europe/London. Your slot is held for 10
                minutes once you continue.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-4 text-[13px] tracking-[0.12em] text-sage uppercase">
                Your details
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={details.first}
                  onChange={(e) => setDetail("first", e.target.value)}
                  placeholder="First name"
                  aria-label="First name"
                  autoComplete="given-name"
                  className={FIELD}
                />
                <input
                  value={details.last}
                  onChange={(e) => setDetail("last", e.target.value)}
                  placeholder="Last name"
                  aria-label="Last name"
                  autoComplete="family-name"
                  className={FIELD}
                />
              </div>
              <div className="mt-3 grid gap-3">
                <input
                  type="email"
                  value={details.email}
                  onChange={(e) => setDetail("email", e.target.value)}
                  placeholder="Email address"
                  aria-label="Email address"
                  autoComplete="email"
                  className={FIELD}
                />
                <input
                  type="tel"
                  value={details.phone}
                  onChange={(e) => setDetail("phone", e.target.value)}
                  placeholder="Mobile number"
                  aria-label="Mobile number"
                  autoComplete="tel"
                  className={FIELD}
                />
                <textarea
                  value={details.notes}
                  onChange={(e) => setDetail("notes", e.target.value)}
                  placeholder="Hair goals or anything we should know"
                  aria-label="Hair goals or anything we should know"
                  rows={3}
                  className={`${FIELD} resize-y`}
                />
              </div>

              <label className="mt-[18px] flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.55] text-muted">
                <input
                  type="checkbox"
                  checked={details.agreed}
                  onChange={(e) => setDetail("agreed", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ink"
                />
                <span>
                  I accept the cancellation policy and understand the deposit is
                  non-refundable within 24 hours of the appointment.
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="pt-5 pb-2.5 text-center">
              <div className="mx-auto mb-6 h-3 w-3 rotate-45 bg-gold" />
              <div className="mb-2.5 font-serif text-[34px]">
                Appointment confirmed
              </div>
              <div className="mb-7 text-[14px] text-muted">
                Confirmation {bookingReference(dateIdx, time)} sent by email and
                SMS.
              </div>

              <dl className="grid gap-3 rounded-[6px] border border-line px-[22px] py-5 text-left text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Service</dt>
                  <dd>{service.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Stylist</dt>
                  <dd>{stylist}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">When</dt>
                  <dd>
                    {formatFullDate(selectedDate)} at {time}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Deposit paid</dt>
                  <dd>£{service.deposit}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-muted">Balance in salon</dt>
                  <dd>
                    £{balance}
                    {service.from ? " onwards" : ""}
                  </dd>
                </div>
              </dl>

              {/* Placeholder, as in the design — wire to a real .ics download later. */}
              <button
                type="button"
                onClick={closeBooking}
                className="mt-6 min-h-[46px] cursor-pointer rounded-[4px] border border-line px-[26px] py-3.5 text-[14px] transition-colors hover:border-gold"
              >
                Add to calendar
              </button>
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="sticky bottom-0 border-t border-line bg-cream px-5 pt-[18px] pb-[22px] sm:px-[30px]">
            <div className="mb-3.5 flex justify-between gap-4 text-[13px] text-muted">
              <span>{summaryLine}</span>
              <span className="text-ink">{formatPrice(service)}</span>
            </div>
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="min-h-[50px] w-full cursor-pointer rounded-[4px] bg-ink p-4 text-[15px] tracking-[0.03em] text-sand transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink"
            >
              {step === 3 ? `Pay £${service.deposit} deposit` : "Continue"}
            </button>
            <div className="mt-2.5 text-center text-[12px] text-muted">
              {step === 1
                ? "Live availability on the next step."
                : step === 2
                  ? "We will hold this slot for 10 minutes."
                  : "Secured by Stripe. Card, Apple Pay and Google Pay."}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
