import type { Metadata } from "next";
import Link from "next/link";
import { NotificationSettingsForm } from "@/components/studio/NotificationSettingsForm";
import { RotateTokenButton } from "@/components/studio/RotateTokenButton";
import { requireManager } from "@/lib/auth/roles";
import { isConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireManager("/studio/settings");
  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, display_name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("display_order");

  const { count: needingReview } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true)
    .is("deleted_at", null);

  if (!salon) {
    return <p className="text-[15px] text-muted">No active salon is configured.</p>;
  }

  return (
    <div className="max-w-[720px]">
      <h2 className="mb-2 font-serif text-[28px] font-light">Settings</h2>
      <p className="mb-10 text-[15px] leading-[1.7] text-muted">
        Booking policy, deposits and opening hours live on the salon record and
        take effect everywhere at once — the figures customers read on{" "}
        <Link href="/policies" className="text-moss underline">
          the policy page
        </Link>{" "}
        are the same ones the booking flow enforces.
      </p>

      {(needingReview ?? 0) > 0 && (
        <div className="mb-10 rounded-[6px] border border-gold px-5 py-4">
          <h3 className="mb-1 text-[15px] font-semibold">
            {needingReview} service{needingReview === 1 ? "" : "s"} need a check
          </h3>
          <p className="text-[14px] leading-[1.7] text-muted">
            Prices came from the salon&rsquo;s price list and are correct.
            Durations, buffers and deposits were not on that list and are
            estimates — confirm them in{" "}
            <Link href="/studio/services" className="text-moss underline">
              the catalogue
            </Link>{" "}
            so availability reflects how long the work really takes.
          </p>
        </div>
      )}

      <section className="mb-12">
        <h3 className="mb-1 font-serif text-[22px]">Booking alerts</h3>
        <p className="mb-5 text-[14px] leading-[1.7] text-muted">
          An email the moment somebody books, so it reaches the phone in your
          pocket without anyone having to open Studio.
        </p>

        {!isConfigured.email() && (
          <p className="mb-5 rounded-[6px] border border-gold px-5 py-4 text-[14px] leading-[1.7] text-muted">
            Email sending is not configured yet, so alerts are queued but not
            sent. Add <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> —
            see <code>docs/SETUP.md</code>. Nothing is lost in the meantime;
            queued messages send once it is set up.
          </p>
        )}

        <NotificationSettingsForm
          defaults={{
            notificationEmail: salon.notification_email ?? "",
            notifyOnBooking: salon.notify_on_booking,
            notifyOnCancellation: salon.notify_on_cancellation,
            fallbackEmail: salon.email ?? null,
          }}
        />
      </section>

      <section className="mb-12">
        <h3 className="mb-1 font-serif text-[22px]">Calendar links</h3>
        <p className="mb-5 text-[14px] leading-[1.7] text-muted">
          Get the feed URLs from{" "}
          <Link href="/studio/calendar/subscribe" className="text-moss underline">
            On your phone
          </Link>
          . Rotate one here if a device is lost — it stops every existing
          subscription to that calendar immediately.
        </p>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line px-5 py-4">
            <span className="text-[15px]">
              {salon.name} — all appointments
            </span>
            <RotateTokenButton target="salon" label={`${salon.name} (all appointments)`} />
          </div>

          {(staff ?? []).map((person) => (
            <div
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line px-5 py-4"
            >
              <span className="text-[15px]">{person.display_name}</span>
              <RotateTokenButton
                target="staff"
                staffId={person.id}
                label={person.display_name}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-serif text-[22px]">Current booking policy</h3>
        <p className="mb-5 text-[14px] leading-[1.7] text-muted">
          Read-only here for now; these are edited directly on the salon record.
        </p>

        <dl className="grid gap-3 rounded-[6px] border border-line px-6 py-5 text-[15px]">
          {[
            ["Timezone", salon.timezone],
            ["Booking window", `${salon.booking_window_days} days ahead`],
            [
              "Minimum notice",
              salon.min_notice_minutes >= 60
                ? `${Math.round(salon.min_notice_minutes / 60)} hours`
                : `${salon.min_notice_minutes} minutes`,
            ],
            ["Free cancellation", `${salon.cancellation_window_hours} hours before`],
            ["Free reschedule", `${salon.reschedule_window_hours} hours before`],
            ["Slot grid", `${salon.slot_interval_minutes} minutes`],
            ["Slot hold at checkout", `${salon.hold_duration_minutes} minutes`],
            ["Deposits", salon.deposit_required ? "Required" : "Not required"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
