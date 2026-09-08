import Link from "next/link";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { pounds } from "@/lib/services";

export default async function Success({searchParams}:{searchParams:Promise<{session_id?:string}>}) {
  const {session_id}=await searchParams;
  let session:Stripe.Checkout.Session|undefined;
  if(session_id) { try { session=await getStripe().checkout.sessions.retrieve(session_id,{expand:["payment_intent"]}); } catch {} }
  const m=session?.metadata || {};
  const intent=session?.payment_intent as Stripe.PaymentIntent|undefined;
  const held=intent?.status === "requires_capture";
  return <main className="success-card"><span className="eyebrow">Prestige Hair Society</span><h1 style={{fontSize:48,lineHeight:1,margin:"16px 0"}}>{held?"Your deposit is secured.":"We’re checking your payment."}</h1><p className="muted">{held?"Your card authorisation is being held while the studio confirms your requested appointment.":"Keep your booking reference. We will email you as soon as the payment status updates."}</p><div className="status-box"><strong>{m.booking_reference||"Booking pending"}</strong><br/>{m.service_name}<br/>{m.appointment_date} at {m.appointment_time}<br/>Deposit: {pounds(Number(m.deposit||0))} · {held?"authorised hold":"processing"}</div><p className="muted">Email updates are sent to {session?.customer_details?.email||m.email||"the address supplied"}. Your remaining balance is paid at KOOP Studio.</p><Link className="button" href="/">Return to the website</Link></main>;
}
