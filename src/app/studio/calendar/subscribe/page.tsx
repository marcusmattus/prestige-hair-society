import type { Metadata } from "next";
import Link from "next/link";
import { CopyField } from "@/components/studio/CopyField";
import { requireStaff } from "@/lib/auth/roles";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Calendar on your phone",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Feed URLs are secrets, so they are assembled server-side for the signed-in
 * person and never appear in a public page or a link a browser might prefetch.
 * Managers see the salon-wide feed; a stylist sees only their own.
 */
export default async function SubscribePage() {
  const user = await requireStaff("/studio/calendar/subscribe");
  const supabase = createAdminClient();

  const manager = user.roles.some((r) => r === "manager" || r === "admin");

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, calendar_token")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, display_name, slug, calendar_token, profile_id")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("display_order");

  const own = (staff ?? []).find((s) => s.profile_id === user.id);
  const visible = manager ? (staff ?? []) : own ? [own] : [];

  // webcal:// makes a phone offer to subscribe rather than download a file.
  const feedUrl = (token: string) => `${appUrl}/api/calendar/${token}`;
  const webcalUrl = (token: string) =>
    feedUrl(token).replace(/^https?:\/\//, "webcal://");

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">
        Your calendar, on your phone
      </h2>
      <p className="mb-10 max-w-[640px] text-[15px] leading-[1.7] text-muted">
        Subscribe once and appointments appear in the calendar app you already
        use, refreshing every fifteen minutes on their own. It is read-only —
        editing an appointment there changes nothing here, so bookings are
        always moved in{" "}
        <Link href="/studio/calendar" className="text-moss underline">
          Studio
        </Link>
        .
      </p>

      {manager && salon && (
        <section className="mb-10">
          <h3 className="mb-1 font-serif text-[22px]">Whole salon</h3>
          <p className="mb-4 max-w-[600px] text-[14px] leading-[1.7] text-muted">
            Every appointment, every stylist. This is the one to put on the
            owner&rsquo;s phone.
          </p>
          <CopyField
            label={`${salon.name} — all appointments`}
            url={feedUrl(salon.calendar_token)}
            webcal={webcalUrl(salon.calendar_token)}
          />
        </section>
      )}

      {visible.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-1 font-serif text-[22px]">
            {manager ? "Individual stylists" : "Your appointments"}
          </h3>
          <p className="mb-4 max-w-[600px] text-[14px] leading-[1.7] text-muted">
            One column only. Useful for a stylist who wants their own day
            without everyone else&rsquo;s.
          </p>
          <div className="grid gap-3">
            {visible.map((person) => (
              <CopyField
                key={person.id}
                label={person.display_name}
                url={feedUrl(person.calendar_token)}
                webcal={webcalUrl(person.calendar_token)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-[6px] border border-line px-6 py-5">
          <h3 className="mb-3 font-serif text-[20px]">iPhone or iPad</h3>
          <ol className="grid gap-2 text-[14px] leading-[1.6] text-muted">
            <li>1. Tap <strong className="text-ink">Add to iPhone</strong> above, on the phone itself.</li>
            <li>2. Tap <strong className="text-ink">Subscribe</strong>, then <strong className="text-ink">Done</strong>.</li>
            <li>
              3. If nothing happens, copy the link and go to Settings →
              Calendar → Accounts → Add Account → Other → Add Subscribed
              Calendar, and paste it.
            </li>
          </ol>
        </div>

        <div className="rounded-[6px] border border-line px-6 py-5">
          <h3 className="mb-3 font-serif text-[20px]">Google Calendar</h3>
          <ol className="grid gap-2 text-[14px] leading-[1.6] text-muted">
            <li>1. Copy the link above.</li>
            <li>
              2. On a computer, open Google Calendar → Other calendars → + →
              <strong className="text-ink"> From URL</strong>, and paste it.
            </li>
            <li>
              3. It then syncs to the Google Calendar app on your phone
              automatically. Google refreshes on its own schedule, which can
              take a few hours the first time.
            </li>
          </ol>
        </div>
      </section>

      <section className="rounded-[6px] border border-line bg-sand px-6 py-5">
        <h3 className="mb-2 text-[13px] tracking-[0.12em] text-sage uppercase">
          Treat the link like a password
        </h3>
        <p className="max-w-[640px] text-[14px] leading-[1.7] text-muted">
          Anyone holding it can read the appointments in it, including customer
          names and phone numbers — a calendar app cannot sign in, so the link
          itself is the credential. Do not post it anywhere. If a phone is lost,
          rotate the token in{" "}
          <Link href="/studio/settings" className="text-moss underline">
            settings
          </Link>
          , which instantly breaks every existing subscription so it can be set
          up again.
        </p>
      </section>
    </div>
  );
}
