import "server-only";

import { Resend } from "resend";
import twilio from "twilio";
import { emailEnv, isConfigured, smsEnv } from "@/lib/env";

/**
 * Provider adapters.
 *
 * Both return a discriminated result rather than throwing, so a failed send
 * marks one delivery row failed instead of aborting a whole reminder batch.
 * When a provider is unconfigured the message is reported as skipped, not
 * sent -- the ledger must never claim something went out that did not.
 */

export type SendResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

let resendClient: Resend | null = null;
function resend() {
  if (!resendClient) resendClient = new Resend(emailEnv().RESEND_API_KEY);
  return resendClient;
}

let twilioClient: ReturnType<typeof twilio> | null = null;
function twilioApi() {
  if (!twilioClient) {
    const env = smsEnv();
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!isConfigured.email()) {
    return { status: "skipped", reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { data, error } = await resend().emails.send({
      from: emailEnv().EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      text: args.text,
      replyTo: args.replyTo,
    });

    if (error) return { status: "failed", error: error.message };
    return { status: "sent", providerMessageId: data?.id ?? null };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendSms(args: { to: string; body: string }): Promise<SendResult> {
  if (!isConfigured.sms()) {
    return { status: "skipped", reason: "Twilio is not configured" };
  }

  const to = toE164(args.to);
  if (!to) return { status: "failed", error: `Unusable mobile number: ${args.to}` };

  try {
    const message = await twilioApi().messages.create({
      from: smsEnv().TWILIO_PHONE_NUMBER,
      to,
      body: args.body,
    });
    return { status: "sent", providerMessageId: message.sid };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Normalise a UK mobile number to E.164.
 *
 * Handles the shapes customers actually type: "07700 900123",
 * "+44 7700 900123", "44 7700 900123", "(07700) 900123".
 * Returns null when the result is not plausibly dialable.
 */
export function toE164(input: string, defaultCountry: "GB" = "GB"): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (defaultCountry === "GB") {
    // 07700900123 -> +447700900123
    if (digits.startsWith("0") && digits.length === 11) return `+44${digits.slice(1)}`;
    // 447700900123 -> +447700900123
    if (digits.startsWith("44") && digits.length === 12) return `+${digits}`;
    // 7700900123 -> +447700900123
    if (digits.length === 10 && digits.startsWith("7")) return `+44${digits}`;
  }

  return null;
}
