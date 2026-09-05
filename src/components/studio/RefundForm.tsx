"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPence, penceToPoundsInput } from "@/lib/money";
import {
  refundPaymentAction,
  type PaymentResult,
} from "@/lib/studio/payment-actions";

const FIELD =
  "min-h-[40px] w-full rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]";

/**
 * Refunding moves real money, so the form is closed by default, states the
 * refundable amount, and requires a reason — which goes to Stripe and into the
 * audit log.
 */
export function RefundForm({
  paymentId,
  refundablePence,
  isInSalon,
}: {
  paymentId: string;
  refundablePence: number;
  isInSalon: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PaymentResult | null, FormData>(
    refundPaymentAction,
    null,
  );

  if (state?.message) {
    return <p role="status" className="max-w-[420px] text-[13px] text-moss">{state.message}</p>;
  }

  if (refundablePence <= 0) {
    return <span className="text-[13px] text-muted">fully refunded</span>;
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }

  return (
    <form action={action} className="w-full max-w-[420px]">
      <input type="hidden" name="paymentId" value={paymentId} />

      {state?.error && (
        <p role="alert" className="mb-3 text-[13px] text-[#B4483C]">
          {state.error}
        </p>
      )}

      <p className="mb-3 text-[13px] text-muted">
        {formatPence(refundablePence)} available to refund.
        {isInSalon &&
          " This was taken in the salon, so recording it here moves no money — hand it back in person."}
      </p>

      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <label className="text-[12px]">
          <span className="mb-1 block tracking-[0.06em] text-sage uppercase">Amount £</span>
          <input
            name="amountPence"
            type="hidden"
            value=""
            aria-hidden="true"
            readOnly
          />
          <input
            name="amountPounds"
            type="number"
            step="0.01"
            min="0.01"
            max={penceToPoundsInput(refundablePence)}
            defaultValue={penceToPoundsInput(refundablePence)}
            required
            className={FIELD}
            onChange={(e) => {
              // The server takes pence; converting here keeps the visible field
              // in pounds without a float ever reaching the database.
              const form = e.currentTarget.form;
              const hidden = form?.elements.namedItem("amountPence");
              if (hidden instanceof HTMLInputElement) {
                hidden.value = String(Math.round(Number(e.currentTarget.value) * 100));
              }
            }}
          />
        </label>

        <label className="text-[12px]">
          <span className="mb-1 block tracking-[0.06em] text-sage uppercase">Reason</span>
          <input
            name="reason"
            required
            maxLength={500}
            placeholder="Cancelled outside the policy window"
            className={FIELD}
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          onClick={(e) => {
            // Populate the pence field for the case where the amount was never
            // edited, so the default value is submitted correctly.
            const form = e.currentTarget.form;
            const pounds = form?.elements.namedItem("amountPounds");
            const hidden = form?.elements.namedItem("amountPence");
            if (pounds instanceof HTMLInputElement && hidden instanceof HTMLInputElement) {
              hidden.value = String(Math.round(Number(pounds.value) * 100));
            }
          }}
        >
          {pending ? "Refunding…" : "Issue refund"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
