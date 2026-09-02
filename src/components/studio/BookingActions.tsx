"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import {
  completeBookingAction,
  markNoShowAction,
  recordInSalonPaymentAction,
  studioCancelBookingAction,
  type ActionResult,
} from "@/lib/studio/actions";
import { formatPence } from "@/lib/money";

const ACTIVE = ["pending_payment", "confirmed"];

/**
 * What the front desk can do to one appointment.
 *
 * Each action is its own form and its own server action, so the permission
 * check happens per action rather than once for the panel: a stylist can mark
 * their own appointment complete but cannot take a payment.
 */
export function BookingActions({
  bookingId,
  status,
  balancePence,
  isManager,
}: {
  bookingId: string;
  status: string;
  balancePence: number;
  isManager: boolean;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [takingPayment, setTakingPayment] = useState(false);

  const [completeState, complete, completing] = useActionState<ActionResult | null, FormData>(
    completeBookingAction,
    null,
  );
  const [noShowState, noShow, marking] = useActionState<ActionResult | null, FormData>(
    markNoShowAction,
    null,
  );
  const [cancelState, cancel, cancelling] = useActionState<ActionResult | null, FormData>(
    studioCancelBookingAction,
    null,
  );
  const [payState, pay, paying] = useActionState<ActionResult | null, FormData>(
    recordInSalonPaymentAction,
    null,
  );

  const result = completeState ?? noShowState ?? cancelState ?? payState;
  const isActive = ACTIVE.includes(status);

  return (
    <section className="rounded-[6px] border border-line px-5 py-5">
      <h2 className="mb-4 text-[12px] tracking-[0.16em] text-sage uppercase">Actions</h2>

      {result?.error && (
        <p role="alert" className="mb-4 text-[14px] text-[#B4483C]">
          {result.error}
        </p>
      )}
      {result?.message && (
        <p role="status" className="mb-4 text-[14px] text-moss">
          {result.message}
        </p>
      )}

      <div className="grid gap-2">
        {isActive && (
          <>
            <form action={complete}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <Button type="submit" size="full" disabled={completing}>
                {completing ? "Saving…" : "Mark completed"}
              </Button>
            </form>

            <form action={noShow}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <Button
                type="submit"
                variant="outline"
                size="full"
                disabled={marking}
              >
                {marking ? "Saving…" : "Mark as no-show"}
              </Button>
            </form>
          </>
        )}

        {isManager && balancePence > 0 && !takingPayment && (
          <Button variant="outline" size="full" onClick={() => setTakingPayment(true)}>
            Record {formatPence(balancePence)} paid in salon
          </Button>
        )}

        {isActive && !confirmingCancel && (
          <Button variant="danger" size="full" onClick={() => setConfirmingCancel(true)}>
            Cancel appointment
          </Button>
        )}
      </div>

      {takingPayment && (
        <form action={pay} className="mt-4 rounded-[6px] border border-line bg-sand p-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          <label htmlFor="amount" className="mb-1.5 block text-[13px] text-muted">
            Amount taken (pence)
          </label>
          <Input
            id="amount"
            name="amountPence"
            type="number"
            min={1}
            max={balancePence}
            defaultValue={balancePence}
            className="mb-3"
          />

          <label htmlFor="pay-notes" className="mb-1.5 block text-[13px] text-muted">
            Note (optional)
          </label>
          <Textarea id="pay-notes" name="notes" rows={2} className="mb-3" />

          <p className="mb-3 text-[12px] leading-[1.5] text-muted">
            For cash or a card machine outside Stripe. Card payments taken
            online record themselves.
          </p>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={paying}>
              {paying ? "Recording…" : "Record payment"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTakingPayment(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {confirmingCancel && (
        <form action={cancel} className="mt-4 rounded-[6px] border border-line bg-sand p-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          <p className="mb-3 text-[14px] leading-[1.6]">
            The slot is released immediately, the client is emailed, and any
            deposit is refunded in full — the salon cancelling is not the same
            as the client cancelling late.
          </p>

          <label htmlFor="cancel-reason" className="mb-1.5 block text-[13px] text-muted">
            Reason (optional, shared with the client)
          </label>
          <Textarea id="cancel-reason" name="reason" rows={2} className="mb-3" />

          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel it"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
              Keep it
            </Button>
          </div>
        </form>
      )}

      {!isActive && (
        <p className="text-[14px] leading-[1.6] text-muted">
          This appointment is {status.replace(/_/g, " ")}, so there is nothing
          left to do here.
        </p>
      )}
    </section>
  );
}
