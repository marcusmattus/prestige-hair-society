import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { pounds } from "@/lib/services";
import { sendBookingEmails } from "@/lib/email";

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
    if (m.email_updates !== "false" && m.email && m.booking_reference) {
      await sendBookingEmails({reference:m.booking_reference,name:`${m.first_name||""} ${m.last_name||""}`.trim(),email:m.email,phone:m.phone||"",service:m.service_name||"Appointment",date:m.appointment_date||"",time:m.appointment_time||"",deposit:pounds(Number(m.deposit||0)),balance:pounds(Math.max(0,Number(m.service_price||0)-Number(m.deposit||0))),paymentStatus:"Authorised — held for approval"});
    }
  }
  return NextResponse.json({received:true});
}
