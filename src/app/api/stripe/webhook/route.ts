import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { pounds, findService } from "@/lib/services";
import { poundsLabel, TIER_LABEL, type Tier } from "@/lib/memberships";
import { appUrl } from "@/lib/env";
import { sendBookingEmails, sendMembershipEmails } from "@/lib/email";
import { recordMembershipPurchase } from "@/lib/memberships/store";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({error:"Webhook is not configured"},{status:400});
  let event:Stripe.Event;
  try { event=getStripe().webhooks.constructEvent(await request.text(),signature,process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({error:"Invalid signature"},{status:400}); }
  if (event.type === "checkout.session.completed") {
    const session=event.data.object;
    const m=session.metadata || {};

    // Membership / programme purchases (deposit-hold bookings are handled below).
    if (m.type === "membership") {
      // Persist first so the dashboard has the record even if email is skipped.
      try { await recordMembershipPurchase(session); }
      catch (cause) { console.error("membership_persist_error", cause); }
      if (m.email_updates !== "false" && m.email && m.booking_reference) {
        const isMonthly = m.payment === "monthly";
        const planLabel = isMonthly && m.months
          ? `${poundsLabel(Number(m.amount_now||0))}/month × ${m.months}`
          : `${poundsLabel(Number(m.total||m.amount_now||0))} paid in full`;
        await sendMembershipEmails({
          reference:m.booking_reference,
          name:`${m.first_name||""} ${m.last_name||""}`.trim(),
          email:m.email,
          programme:m.programme_name||"Programme",
          category:m.category||"",
          tier:TIER_LABEL[(m.tier as Tier)]||m.tier||"",
          duration:m.duration||"",
          visits:m.visits?Number(m.visits):undefined,
          planLabel,
          bookVisitUrl:`${appUrl.replace(/\/$/,"")}/#book`,
          accountUrl:`${appUrl.replace(/\/$/,"")}/account`,
        });
      }
      return NextResponse.json({received:true});
    }

    if (m.email_updates !== "false" && m.email && m.booking_reference) {
      const paidInFull = m.payment_type === "full";
      const paidAmount = Number(m.amount || m.deposit || 0);
      const duration = (m.service_id ? findService(m.service_id)?.duration : undefined) ?? 60;
      await sendBookingEmails({
        reference:m.booking_reference,
        name:`${m.first_name||""} ${m.last_name||""}`.trim(),
        email:m.email,
        phone:m.phone||"",
        service:m.service_name||"Appointment",
        date:m.appointment_date||"",
        time:m.appointment_time||"",
        deposit:pounds(paidInFull ? paidAmount : Number(m.deposit||0)),
        balance:pounds(Math.max(0,Number(m.service_price||0)-Number(m.deposit||0))),
        paymentStatus:paidInFull ? "Paid in full" : "Authorised — held for approval",
        durationMinutes:duration,
        paidInFull,
      });
    }
  }
  return NextResponse.json({received:true});
}
