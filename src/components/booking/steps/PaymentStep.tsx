"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPence } from "@/lib/money";

/**
 * Deposit payment via the Stripe Payment Element, which brings card, Apple Pay
 * and Google Pay with it.
 *
 * Card details never touch this origin: the Element is a cross-origin iframe
 * hosted by Stripe. On success the browser is redirected to the confirmation
 * page, but that page does not confirm the booking -- the webhook does.
 */

/** Stripe's theme, matched to the salon's palette. */
const appearance: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#213126",
    colorBackground: "#ffffff",
    colorText: "#213126",
    colorDanger: "#B4483C",
    fontFamily: "Manrope, system-ui, sans-serif",
    borderRadius: "4px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(33,49,38,0.16)", boxShadow: "none", padding: "13px 14px" },
    ".Input:focus": { border: "1px solid #AF946A", boxShadow: "none" },
    ".Label": { color: "#687067", fontSize: "13px" },
  },
};

export function PaymentStep({
  publishableKey,
  clientSecret,
  amountPence,
  reference,
  returnUrl,
  formId,
}: {
  publishableKey: string;
  clientSecret: string;
  amountPence: number;
  reference: string;
  returnUrl: string;
  formId: string;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  return (
    <div>
      <h2 className="mb-1 font-serif text-[30px] font-light md:text-[36px]">
        Secure your appointment
      </h2>
      <p className="mb-6 text-[15px] text-muted">
        A {formatPence(amountPence)} deposit confirms your booking. The balance
        is settled in the salon.
      </p>

      <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
        <PaymentForm returnUrl={returnUrl} reference={reference} formId={formId} />
      </Elements>

      <p className="mt-6 text-[13px] leading-[1.6] text-muted">
        Payments are processed by Stripe. We never see or store your card
        details.
      </p>
    </div>
  );
}

function PaymentForm({
  returnUrl,
  reference,
  formId,
}: {
  returnUrl: string;
  reference: string;
  formId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${returnUrl}?ref=${encodeURIComponent(reference)}` },
    });

    // Reaching here at all means the redirect did not happen, so this is an
    // immediate validation or card error. Anything else redirects away.
    if (stripeError) {
      setError(
        stripeError.message ??
          "We could not take that payment. Please check the details and try again.",
      );
    }
    setSubmitting(false);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p role="alert" className="mt-4 text-[14px] text-[#B4483C]">
          {error}
        </p>
      )}

      {/* The sticky footer submits this form; this is the non-JS fallback. */}
      <noscript>
        <Button type="submit" size="full" className="mt-5">
          Pay deposit
        </Button>
      </noscript>

      <input type="hidden" name="submitting" value={String(submitting)} />
    </form>
  );
}
