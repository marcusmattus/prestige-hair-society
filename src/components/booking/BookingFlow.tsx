"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { BookingCatalogue } from "@/lib/salon";
import { formatPence } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CustomerDetails, CustomerDetailsInput } from "@/lib/validation";
import { BookingSummary } from "./BookingSummary";
import { HoldCountdown } from "./HoldCountdown";
import {
  STEP_LABELS,
  STEP_ORDER,
  eligibleStaff,
  findService,
  initialState,
  reachableSteps,
  reducer,
  totalMinutes,
  totalPence,
  type Step,
} from "./flow-state";
import { DateTimeStep } from "./steps/DateTimeStep";
import { DetailsStep } from "./steps/DetailsStep";
import { PaymentStep } from "./steps/PaymentStep";
import { ServiceStep } from "./steps/ServiceStep";
import { StylistStep } from "./steps/StylistStep";

const DETAILS_FORM = "booking-details-form";
const PAYMENT_FORM = "booking-payment-form";

export function BookingFlow({
  catalogue,
  signedIn,
  customerDefaults,
  stripePublishableKey,
  initialServiceId,
  initialStaffId,
}: {
  catalogue: BookingCatalogue;
  signedIn: boolean;
  customerDefaults?: Partial<CustomerDetailsInput>;
  stripePublishableKey: string | null;
  initialServiceId?: string;
  initialStaffId?: string;
}) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    serviceId: initialServiceId ?? null,
    staffId: initialStaffId ?? null,
    anyStylist: !initialStaffId,
    step: initialServiceId ? (initialStaffId ? "datetime" : "stylist") : "service",
  });

  const service = findService(catalogue.services, state.serviceId);
  const staffForService = eligibleStaff(service, catalogue.staff);
  const chosenStaff = catalogue.staff.find((s) => s.id === state.staffId) ?? null;
  const total = totalPence(service, state.addonIds);
  const minutes = totalMinutes(service, state.addonIds);
  const timezone = catalogue.salon.timezone;

  // Release the hold if the customer navigates away mid-checkout, so the chair
  // is freed immediately rather than after the timeout. The ref is written in
  // an effect, not during render, so the listener always sees the token that
  // was current at the last commit.
  const holdTokenRef = useRef<string | null>(null);

  useEffect(() => {
    holdTokenRef.current = state.hold?.token ?? null;
  }, [state.hold]);

  useEffect(() => {
    function releaseOnUnload() {
      const token = holdTokenRef.current;
      if (!token) return;
      navigator.sendBeacon?.(`/api/holds?holdToken=${token}&_method=DELETE`);
    }
    window.addEventListener("pagehide", releaseOnUnload);
    return () => window.removeEventListener("pagehide", releaseOnUnload);
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const placeHold = useCallback(async () => {
    if (!service || !state.slotStart || !state.slotStaffId) return;
    dispatch({ type: "setBusy", busy: true });

    try {
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          staffId: state.slotStaffId,
          startsAt: state.slotStart,
          addonIds: state.addonIds,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        dispatch({ type: "setError", error: body.message ?? "We could not hold that slot." });
        if (res.status === 409) dispatch({ type: "clearSlot" });
        return;
      }

      dispatch({
        type: "holdPlaced",
        hold: {
          token: body.holdToken,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          expiresAt: body.expiresAt,
        },
      });
    } catch {
      dispatch({ type: "setError", error: "We could not reach the salon. Please try again." });
    }
  }, [service, state.slotStart, state.slotStaffId, state.addonIds]);

  const submitDetails = useCallback(
    async (details: CustomerDetails) => {
      if (!state.hold) return;
      dispatch({ type: "setBusy", busy: true });

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            holdToken: state.hold.token,
            details,
            addonIds: state.addonIds,
          }),
        });
        const body = await res.json();

        if (!res.ok) {
          dispatch({ type: "setError", error: body.message ?? "We could not create the booking." });
          if (res.status === 410) dispatch({ type: "holdReleased" });
          return;
        }

        dispatch({
          type: "bookingCreated",
          bookingId: body.bookingId,
          reference: body.reference,
        });
      } catch {
        dispatch({ type: "setError", error: "We could not reach the salon. Please try again." });
      }
    },
    [state.hold, state.addonIds],
  );

  // Create the PaymentIntent as soon as the payment step is reached.
  useEffect(() => {
    if (state.step !== "payment" || !state.bookingId || state.clientSecret) return;

    let cancelled = false;
    dispatch({ type: "setBusy", busy: true });

    fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: state.bookingId, kind: "deposit" }),
    })
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          dispatch({ type: "setError", error: body.message ?? "We could not start the payment." });
          return;
        }
        dispatch({ type: "paymentReady", clientSecret: body.clientSecret });
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: "setError", error: "We could not start the payment." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.step, state.bookingId, state.clientSecret]);

  const onHoldExpired = useCallback(() => {
    dispatch({ type: "holdReleased" });
    dispatch({
      type: "setError",
      error: "Your slot was released after ten minutes. Please choose a time again.",
    });
  }, []);

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------

  const canContinue = (() => {
    switch (state.step) {
      case "service":
        return !!service;
      case "stylist":
        return state.anyStylist || !!state.staffId;
      case "datetime":
        return !!state.slotStart;
      case "details":
        return true; // the form validates on submit
      case "payment":
        return !!state.clientSecret;
    }
  })();

  const ctaLabel = (() => {
    switch (state.step) {
      case "datetime":
        return "Hold this slot";
      case "details":
        return "Continue to payment";
      case "payment":
        return service ? `Pay ${formatPence(Math.min(service.deposit_pence, total))} deposit` : "Pay deposit";
      default:
        return "Continue";
    }
  })();

  const ctaHint = (() => {
    switch (state.step) {
      case "service":
        return "Choose a stylist next.";
      case "stylist":
        return "Live availability on the next step.";
      case "datetime":
        return "We will hold this slot for ten minutes.";
      case "details":
        return "You can review everything before you pay.";
      case "payment":
        return "Secured by Stripe. Card, Apple Pay and Google Pay.";
    }
  })();

  function handleContinue() {
    switch (state.step) {
      case "service":
        dispatch({ type: "goTo", step: "stylist" });
        break;
      case "stylist":
        dispatch({ type: "goTo", step: "datetime" });
        break;
      case "datetime":
        void placeHold();
        break;
      // details and payment submit their own forms via the form attribute.
    }
  }

  const reachable = reachableSteps(state);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-10 md:px-10 lg:grid-cols-[1fr_380px] lg:gap-16 lg:py-16">
      <div>
        <Stepper
          current={state.step}
          reachable={reachable}
          onSelect={(step) => dispatch({ type: "goTo", step })}
        />

        {state.error && (
          <p
            role="alert"
            className="mt-6 rounded-[6px] border border-[#B4483C] bg-[#B4483C]/5 px-5 py-4 text-[14px] text-[#B4483C]"
          >
            {state.error}
          </p>
        )}

        <div className="mt-8">
          {state.step === "service" && (
            <ServiceStep
              categories={catalogue.categories}
              services={catalogue.services}
              selectedId={state.serviceId}
              addonIds={state.addonIds}
              onSelect={(serviceId) => dispatch({ type: "selectService", serviceId })}
              onToggleAddon={(addonId) => dispatch({ type: "toggleAddon", addonId })}
            />
          )}

          {state.step === "stylist" && (
            <StylistStep
              staff={staffForService}
              selectedId={state.staffId}
              anyStylist={state.anyStylist}
              onSelect={(staffId) => dispatch({ type: "selectStylist", staffId })}
            />
          )}

          {state.step === "datetime" && service && (
            <DateTimeStep
              serviceId={service.id}
              staffId={state.anyStylist ? null : state.staffId}
              addonIds={state.addonIds}
              bookingWindowDays={catalogue.salon.booking_window_days}
              timezone={timezone}
              selectedSlot={state.slotStart}
              onSelectSlot={(startsAt, staffId) =>
                dispatch({ type: "selectSlot", startsAt, staffId })
              }
            />
          )}

          {state.step === "details" && (
            <DetailsStep
              formId={DETAILS_FORM}
              signedIn={signedIn}
              defaultValues={customerDefaults}
              onSubmit={submitDetails}
            />
          )}

          {state.step === "payment" && service && (
            <>
              {!stripePublishableKey && (
                <p
                  role="alert"
                  className="rounded-[6px] border border-line bg-sand px-5 py-4 text-[14px] text-muted"
                >
                  Card payments are not switched on yet. Your appointment is
                  reserved as {state.reference} — please call the salon to
                  secure it with a deposit.
                </p>
              )}
              {stripePublishableKey && state.clientSecret && state.reference && (
                <PaymentStep
                  formId={PAYMENT_FORM}
                  publishableKey={stripePublishableKey}
                  clientSecret={state.clientSecret}
                  amountPence={Math.min(service.deposit_pence, total)}
                  reference={state.reference}
                  returnUrl={`${window.location.origin}/booking/confirmation`}
                />
              )}
              {stripePublishableKey && !state.clientSecret && !state.error && (
                <p className="py-8 text-[14px] text-muted">Preparing secure payment…</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary: a sidebar on desktop, a sticky footer on mobile. */}
      <aside className="lg:sticky lg:top-[120px] lg:self-start">
        <div className="rounded-[6px] border border-line bg-cream p-6">
          <h2 className="mb-4 text-[12px] tracking-[0.18em] text-sage uppercase">
            Your appointment
          </h2>
          <BookingSummary
            service={service}
            addonIds={state.addonIds}
            staff={chosenStaff}
            anyStylist={state.anyStylist}
            slotStart={state.slotStart}
            timezone={timezone}
            totalPence={total}
            totalMinutes={minutes}
          />

          {state.hold && (
            <div className="mt-4 border-t border-line pt-4">
              <HoldCountdown expiresAt={state.hold.expiresAt} onExpired={onHoldExpired} />
            </div>
          )}
        </div>

        <div className="mt-4 hidden lg:block">
          <FooterActions
            step={state.step}
            busy={state.busy}
            canContinue={canContinue}
            ctaLabel={ctaLabel}
            ctaHint={ctaHint}
            onBack={() => dispatch({ type: "back" })}
            onContinue={handleContinue}
          />
        </div>
      </aside>

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-cream px-5 py-4 md:-mx-10 md:px-10 lg:hidden">
        <FooterActions
          step={state.step}
          busy={state.busy}
          canContinue={canContinue}
          ctaLabel={ctaLabel}
          ctaHint={ctaHint}
          onBack={() => dispatch({ type: "back" })}
          onContinue={handleContinue}
        />
      </div>
    </div>
  );
}

function FooterActions({
  step,
  busy,
  canContinue,
  ctaLabel,
  ctaHint,
  onBack,
  onContinue,
}: {
  step: Step;
  busy: boolean;
  canContinue: boolean;
  ctaLabel: string;
  ctaHint: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  // The details and payment steps submit their own forms, so the button is
  // associated with them rather than firing an onClick.
  const formId =
    step === "details" ? DETAILS_FORM : step === "payment" ? PAYMENT_FORM : undefined;

  return (
    <div>
      <div className="flex gap-3">
        {step !== "service" && (
          <Button variant="outline" size="md" onClick={onBack} disabled={busy}>
            Back
          </Button>
        )}
        <Button
          type={formId ? "submit" : "button"}
          form={formId}
          size="full"
          disabled={!canContinue || busy}
          onClick={formId ? undefined : onContinue}
          className={cn(step === "service" && "w-full")}
        >
          {busy ? "Please wait…" : ctaLabel}
        </Button>
      </div>
      <p className="mt-2.5 text-center text-[12px] text-muted">{ctaHint}</p>
    </div>
  );
}

function Stepper({
  current,
  reachable,
  onSelect,
}: {
  current: Step;
  reachable: Step[];
  onSelect: (step: Step) => void;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <ol className="grid grid-cols-5 gap-2">
      {STEP_ORDER.map((step, index) => {
        const done = index < currentIndex;
        const active = step === current;
        const canJump = reachable.includes(step) && index < currentIndex;

        return (
          <li key={step}>
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onSelect(step)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "w-full text-center",
                canJump ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "block h-[2px] rounded-[2px]",
                  done || active ? "bg-ink" : "bg-line",
                )}
              />
              <span
                className={cn(
                  "mt-2 block text-[11px] tracking-[0.1em] uppercase",
                  done || active ? "text-ink" : "text-sage",
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
