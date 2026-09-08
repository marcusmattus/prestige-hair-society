import "server-only";
import { Resend } from "resend";

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
};

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

function emailHtml(data: BookingEmail) {
  const row = (label: string, value: string) => `<tr><td style="padding:9px 0;color:#687067">${label}</td><td style="padding:9px 0;text-align:right;color:#213126">${escape(value)}</td></tr>`;
  return `<div style="background:#fbfaf6;padding:36px 18px;font-family:Arial,sans-serif;color:#213126"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ded9cd;padding:32px"><p style="font-size:12px;letter-spacing:2px;color:#8f9b7b;text-transform:uppercase">Prestige Hair Society</p><h1 style="font-family:Georgia,serif;font-weight:400">Your appointment request is secured.</h1><p>Hi ${escape(data.name)}, your deposit has been authorised and is being held while Nekeia confirms your appointment.</p><table style="width:100%;border-collapse:collapse;margin:24px 0">${row("Reference", data.reference)}${row("Service", data.service)}${row("When", `${data.date} at ${data.time}`)}${row("Deposit", data.deposit)}${row("Payment", data.paymentStatus)}${row("Balance at salon", data.balance)}</table><p style="line-height:1.6;color:#687067">You will receive another email if the appointment changes. The authorised deposit is captured only after booking approval; otherwise the hold is released automatically by your bank.</p><p style="margin-top:28px">KOOP Studio<br>2 Queenstown Road<br>London SW8 3RX</p></div></div>`;
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
