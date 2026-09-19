import { NextResponse } from "next/server";
import { z } from "zod";
import { findService, TIMES, pounds } from "@/lib/services";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const schema = z.object({
  bookingId:z.string().min(8).max(100), serviceId:z.string().min(3), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:z.enum(TIMES as [string,...string[]]), firstName:z.string().trim().min(1).max(80), lastName:z.string().trim().min(1).max(80),
  email:z.email(), phone:z.string().trim().min(7).max(30), notes:z.string().max(1000).default(""), updates:z.boolean().default(true), agreed:z.literal(true),
  // "deposit": authorise a deposit hold, captured on approval (default).
  // "full": charge the full service price immediately.
  payment:z.enum(["deposit","full"]).default("deposit"),
});

export async function POST(request:Request) {
  try {
    const input = schema.parse(await request.json());
    const service = findService(input.serviceId);
    if (!service) return NextResponse.json({error:"Please choose a valid service"},{status:400});
    const requested = new Date(`${input.date}T${input.time}:00`);
    if (!Number.isFinite(requested.valueOf()) || requested < new Date()) return NextResponse.json({error:"Please choose a future appointment"},{status:400});
    const reference = `PHS-${input.bookingId.replace(/-/g,"").slice(0,8).toUpperCase()}`;
    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    const payInFull = input.payment === "full";
    const amount = payInFull ? service.price : service.deposit; // pounds
    const lineName = payInFull ? `${service.name}` : `Deposit hold · ${service.name}`;
    const lineDescription = payInFull
      ? `${input.date} at ${input.time} · Paid in full`
      : `${input.date} at ${input.time} · Balance ${pounds(service.price-service.deposit)} paid at the studio`;

    const session = await stripe.checkout.sessions.create({
      mode:"payment", customer_email:input.email, payment_method_types:["card"],
      line_items:[{quantity:1,price_data:{currency:"gbp",unit_amount:amount*100,product_data:{name:lineName,description:lineDescription}}}],
      // A deposit is authorised and captured later on approval; a full payment
      // is captured immediately (Stripe's default automatic capture).
      payment_intent_data:{...(payInFull?{}:{capture_method:"manual" as const}),description:`${reference} · ${service.name}`,metadata:{booking_reference:reference,booking_id:input.bookingId,payment_type:input.payment}},
      success_url:`${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${origin}/#book`,
      metadata:{booking_reference:reference,booking_id:input.bookingId,service_id:service.id,service_name:service.name,service_price:String(service.price),deposit:String(service.deposit),amount:String(amount),payment_type:input.payment,appointment_date:input.date,appointment_time:input.time,first_name:input.firstName,last_name:input.lastName,email:input.email,phone:input.phone,notes:input.notes,email_updates:String(input.updates)},
      expires_at:Math.floor(Date.now()/1000)+30*60,
    },{idempotencyKey:`checkout-${input.bookingId}-${input.payment}-${amount}`});
    return NextResponse.json({url:session.url});
  } catch (cause) {
    console.error("checkout_error",cause);
    const message = cause instanceof z.ZodError ? "Please check all booking details" : cause instanceof Error && cause.message.includes("configured") ? "Secure payments are being connected. Please try again shortly." : "Unable to start secure checkout";
    return NextResponse.json({error:message},{status:400});
  }
}
