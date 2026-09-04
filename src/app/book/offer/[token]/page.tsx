import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "A slot has opened up",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Waiting-list offer landing page.
 *
 * The token proves the offer was sent to this person. It does NOT reserve the
 * slot -- /api/cron/waitlist deliberately leaves the chair bookable, so this
 * page has to re-check availability before it sends anyone to checkout, and
 * say so plainly when the slot has gone.
 *
 * The lookup runs on the admin client because the visitor may not be signed
 * in; the unguessable token is what authorises the read, and nothing beyond
 * this one entry is exposed.
 */
export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: entry } = await supabase
    .from("waitlist_entries")
    .select(
      `id, status, offer_expires_at, offered_slot_starts_at, offered_staff_id, service_id,
       service:service_id(name, slug, base_price_pence, pricing_mode, duration_minutes),
       staff:offered_staff_id(display_name, slug),
       salon:salon_id(timezone)`,
    )
    .eq("offer_token", token)
    .maybeSingle();

  const tz = entry?.salon?.timezone ?? "Europe/London";
  const expired =
    !entry ||
    entry.status !== "offered" ||
    !entry.offer_expires_at ||
    new Date(entry.offer_expires_at) <= new Date();

  // Even inside the offer window, confirm the slot is genuinely still free.
  let stillAvailable = false;
  if (!expired && entry?.offered_slot_starts_at && entry.offered_staff_id) {
    const slotStart = new Date(entry.offered_slot_starts_at);
    const date = slotStart.toISOString().slice(0, 10);

    const { data: slots } = await supabase.rpc("available_slots", {
      p_service_id: entry.service_id,
      p_from: date,
      p_to: date,
      p_staff_id: entry.offered_staff_id,
      p_extra_minutes: 0,
    } as never);

    stillAvailable = ((slots ?? []) as unknown as { slot_start: string }[]).some(
      (slot) =>
        new Date(slot.slot_start).getTime() === slotStart.getTime(),
    );
  }

  if (!entry || expired || !stillAvailable) {
    return (
      <>
        <SiteHeader />
        <main>
          <PageHeader
            eyebrow="Waiting list"
            title={expired || !entry ? "This offer has expired." : "That slot has just gone."}
            lede={
              expired || !entry
                ? "Offers are held for an hour, then passed to the next person on the list. You are still on it — we will email you again when something else opens."
                : "Somebody booked it before you got here. You are still on the waiting list, and we will email you the next match."
            }
          />
          <div className="mx-auto max-w-[720px] px-5 py-14 md:px-10">
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/book">See what else is free</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account">Manage your waiting list</Link>
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const service = entry.service;
  const staff = entry.staff;
  const bookHref = `/book?service=${service?.slug ?? ""}&stylist=${staff?.slug ?? ""}&slot=${encodeURIComponent(entry.offered_slot_starts_at!)}`;

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Waiting list"
          title="A slot has opened up."
          lede="It is yours if you want it. Booking takes about a minute."
        />

        <div className="mx-auto max-w-[720px] px-5 py-14 md:px-10">
          <dl className="mb-8 grid gap-3 rounded-[6px] border border-line px-6 py-6 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Service</dt>
              <dd>{service?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Stylist</dt>
              <dd>{staff?.display_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">When</dt>
              <dd>{formatWhenLong(entry.offered_slot_starts_at!, tz)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <dt className="text-muted">Price</dt>
              <dd>
                {service
                  ? formatPrice(service.base_price_pence, service.pricing_mode)
                  : "—"}
              </dd>
            </div>
          </dl>

          <Button asChild size="lg">
            <Link href={bookHref}>Take this appointment</Link>
          </Button>

          <p className="mt-5 text-[13px] leading-[1.6] text-muted">
            Offered to you until{" "}
            {formatWhenLong(entry.offer_expires_at!, tz)}. The slot is not held
            until you reach the payment step, so it is worth booking now rather
            than later.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
