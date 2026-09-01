import type { Metadata } from "next";
import { PreferencesForm } from "@/components/account/PreferencesForm";
import { requireUser } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Contact preferences",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await requireUser("/account/preferences");

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Contact preferences</h2>
      <p className="mb-8 max-w-[560px] text-[15px] leading-[1.7] text-muted">
        Appointment reminders and marketing are separate. Turning marketing off
        does not stop us confirming or reminding you about a booking you have
        made — those are part of the service.
      </p>

      <PreferencesForm
        defaults={{
          marketingEmail: user.profile.marketing_email,
          marketingSms: user.profile.marketing_sms,
          reminderEmail: user.profile.reminder_email,
          reminderSms: user.profile.reminder_sms,
        }}
      />
    </div>
  );
}
