import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
    appInfo: { name: "Prestige Hair Society Booking", version: "1.0.0" },
  });
  return client;
}
