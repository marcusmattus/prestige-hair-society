import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/ProfileForm";
import { requireUser } from "@/lib/auth/roles";
import { getStaff } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, stylists] = await Promise.all([
    requireUser("/account/profile"),
    getStaff(),
  ]);

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Your details</h2>
      <p className="mb-8 max-w-[560px] text-[15px] leading-[1.7] text-muted">
        Keeping your mobile number current matters most — it is where
        appointment reminders go.
      </p>

      <ProfileForm
        stylists={stylists.map((s) => ({ id: s.id, display_name: s.display_name }))}
        defaults={{
          firstName: user.profile.first_name,
          lastName: user.profile.last_name,
          phone: user.profile.phone ?? "",
          birthday: user.profile.birthday ?? "",
          hairGoals: user.profile.hair_goals ?? "",
          accessibilityRequirements: user.profile.accessibility_requirements ?? "",
          allergies: user.profile.allergies ?? "",
          favouriteStaffId: user.profile.favourite_staff_id ?? "",
        }}
      />
    </div>
  );
}
