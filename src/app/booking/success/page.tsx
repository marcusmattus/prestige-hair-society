import Link from "next/link";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { pounds, findService } from "@/lib/services";
import { CALENDLY_CONSULTATION_URL, calendlyConsultationLink } from "@/lib/calendly";

export default async function Success({searchParams}:{searchParams:Promise<{session_id?:string}>}) {
  const {session_id}=await searchParams;
  let session:Stripe.Checkout.Session|undefined;
  if(session_id) { try { session=await getStripe().checkout.sessions.retrieve(session_id,{expand:["payment_intent"]}); } catch {} }
  const m=session?.metadata || {};
  const intent=session?.payment_intent as Stripe.PaymentIntent|undefined;
  const paidInFull=m.payment_type === "full";
  const held=intent?.status === "requires_capture";
  const settled=intent?.status === "succeeded";

  const heading=paidInFull
    ? (settled ? "Your appointment is paid." : "We’re confirming your payment.")
    : (held ? "Your deposit is secured." : "We’re checking your payment.");
  const blurb=paidInFull
    ? (settled ? "Your appointment is paid in full and your requested time is with the studio for confirmation." : "Keep your booking reference. We will email you as soon as the payment status updates.")
    : (held ? "Your card authorisation is being held while the studio confirms your requested appointment." : "Keep your booking reference. We will email you as soon as the payment status updates.");

  const email=session?.customer_details?.email||m.email||"the address supplied";
  const name=`${m.first_name||""} ${m.last_name||""}`.trim();
  const duration=(m.service_id?findService(m.service_id)?.duration:undefined)??60;

  // Real "Add to calendar" for the requested slot, plus a Calendly link for
  // anyone who would rather talk through their hair goals first.
  const calendarHref=m.appointment_date&&m.appointment_time
    ? `/api/calendar?${new URLSearchParams({reference:m.booking_reference||"PHS",service:m.service_name||"Appointment",date:m.appointment_date,time:m.appointment_time,mins:String(duration)}).toString()}`
    : null;
  const consultationHref=calendlyConsultationLink({name,email:m.email});

  return <main className="success-card">
    <span className="eyebrow">Prestige Hair Society</span>
    <h1 style={{fontSize:48,lineHeight:1,margin:"16px 0"}}>{heading}</h1>
    <p className="muted">{blurb}</p>
    <div className="status-box">
      <strong>{m.booking_reference||"Booking pending"}</strong><br/>
      {m.service_name}<br/>
      {m.appointment_date} at {m.appointment_time}<br/>
      {paidInFull
        ? <>Paid in full: {pounds(Number(m.service_price||m.amount||0))} · {settled?"paid":"processing"}</>
        : <>Deposit: {pounds(Number(m.deposit||0))} · {held?"authorised hold":"processing"}</>}
    </div>
    <p className="muted">Email updates are sent to {email}.{paidInFull?"":" Your remaining balance is paid at KOOP Studio."}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:24}}>
      {calendarHref&&<a className="button" href={calendarHref}>Add to calendar</a>}
      <a className="button alt" href={consultationHref} target="_blank" rel="noopener noreferrer">Book a consultation</a>
      <Link className="button alt" href="/">Return to the website</Link>
    </div>
    <p className="secure" style={{marginTop:20}}><span>◆</span><span>Prefer to talk first? Schedule a free consultation with your stylist at {CALENDLY_CONSULTATION_URL.replace("https://","")}.</span></p>
  </main>;
}
