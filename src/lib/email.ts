import "server-only";
import { Resend } from "resend";
import { appUrl } from "@/lib/env";
import { CALENDLY_CONSULTATION_URL, calendlyConsultationLink } from "@/lib/calendly";

export type BookingEmail = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  deposit: string;
  balance: string;
  paymentStatus: string;
  /** Appointment length, for the "Add to calendar" event. Defaults to 60. */
  durationMinutes?: number;
  /** True when the client paid the full price rather than a deposit hold. */
  paidInFull?: boolean;
};

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

/** Absolute link to the .ics download for this appointment. */
function calendarUrl(data: BookingEmail) {
  const query = new URLSearchParams({
    reference: data.reference,
    service: data.service,
    date: data.date,
    time: data.time,
    mins: String(data.durationMinutes ?? 60),
  });
  return `${appUrl.replace(/\/$/, "")}/api/calendar?${query.toString()}`;
}

function emailHtml(data: BookingEmail) {
  const row = (label: string, value: string) => `<tr><td style="padding:9px 0;color:#687067">${label}</td><td style="padding:9px 0;text-align:right;color:#213126">${escape(value)}</td></tr>`;
  const button = (href: string, label: string, filled: boolean) => `<a href="${escape(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border-radius:4px;font-size:14px;text-decoration:none;${filled ? "background:#213126;color:#fbfaf6" : "border:1px solid #af946a;color:#213126"}">${label}</a>`;
  const consult = calendlyConsultationLink({ name: data.name, email: data.email });
  const headline = data.paidInFull ? "Your appointment is paid and secured." : "Your appointment request is secured.";
  const intro = data.paidInFull
    ? `Hi ${escape(data.name)}, your payment is complete and your requested time is with Nekeia for confirmation.`
    : `Hi ${escape(data.name)}, your deposit has been authorised and is being held while Nekeia confirms your appointment.`;
  const paymentNote = data.paidInFull
    ? "You will receive another email if the appointment changes. Your payment covers this service in full."
    : "You will receive another email if the appointment changes. The authorised deposit is captured only after booking approval; otherwise the hold is released automatically by your bank.";
  return `<div style="background:#fbfaf6;padding:36px 18px;font-family:Arial,sans-serif;color:#213126"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ded9cd;padding:32px"><p style="font-size:12px;letter-spacing:2px;color:#8f9b7b;text-transform:uppercase">Prestige Hair Society</p><h1 style="font-family:Georgia,serif;font-weight:400">${headline}</h1><p>${intro}</p><table style="width:100%;border-collapse:collapse;margin:24px 0">${row("Reference", data.reference)}${row("Service", data.service)}${row("When", `${data.date} at ${data.time}`)}${row(data.paidInFull ? "Paid" : "Deposit", data.deposit)}${row("Payment", data.paymentStatus)}${data.paidInFull ? "" : row("Balance at salon", data.balance)}</table><div style="margin:24px 0">${button(calendarUrl(data), "Add to calendar", true)}${button(consult, "Book a consultation", false)}</div><p style="line-height:1.6;color:#687067">${paymentNote}</p><p style="line-height:1.6;color:#687067">Prefer to talk your hair goals through first? Schedule a free consultation at ${escape(CALENDLY_CONSULTATION_URL)}.</p><p style="margin-top:28px">KOOP Studio<br>2 Queenstown Road<br>London SW8 3RX</p></div></div>`;
}

export async function sendBookingEmails(data: BookingEmail) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "Prestige Hair Society <onboarding@resend.dev>";
  const admin = process.env.BOOKINGS_EMAIL;
  const messages = [{ from, to: data.email, subject: `Booking ${data.reference}: deposit secured`, html: emailHtml(data) }];
  if (admin) messages.push({ from, to: admin, subject: `New booking request ${data.reference}`, html: emailHtml(data) });
  return resend.batch.send(messages);
}
