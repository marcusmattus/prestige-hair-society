import type { Metadata } from "next";
import Link from "next/link";
import {
  StaffEditor,
  type ServiceOption,
  type StaffRecord,
} from "@/components/studio/StaffEditor";
import { requireManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Stylists",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StylistsPage() {
  await requireManager("/studio/stylists");
  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) {
    return <p className="text-[15px] text-muted">No active salon is configured.</p>;
  }

  const [{ data: staff }, { data: services }, { data: links }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("*")
        .eq("salon_id", salon.id)
        .is("deleted_at", null)
        .order("display_order"),
      supabase
        .from("services")
        .select("id, name, category:category_id(name)")
        .eq("salon_id", salon.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order"),
      supabase.from("staff_services").select("staff_id, service_id"),
      supabase
        .from("bookings")
        .select("staff_id")
        .in("status", ["pending_payment", "confirmed"])
        .gte("starts_at", new Date().toISOString()),
    ]);

  const servicesByStaff = new Map<string, string[]>();
  for (const link of links ?? []) {
    servicesByStaff.set(link.staff_id, [
      ...(servicesByStaff.get(link.staff_id) ?? []),
      link.service_id,
    ]);
  }

  const upcomingByStaff = new Map<string, number>();
  for (const row of upcoming ?? []) {
    upcomingByStaff.set(row.staff_id, (upcomingByStaff.get(row.staff_id) ?? 0) + 1);
  }

  const records: StaffRecord[] = (staff ?? []).map((person) => ({
    id: person.id,
    slug: person.slug,
    displayName: person.display_name,
    title: person.title,
    bio: person.bio,
    specialties: person.specialties,
    isBookable: person.is_bookable,
    isActive: person.is_active,
    displayOrder: person.display_order,
    serviceIds: servicesByStaff.get(person.id) ?? [],
    upcomingCount: upcomingByStaff.get(person.id) ?? 0,
  }));

  const serviceOptions: ServiceOption[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    categoryName: (s.category as { name: string } | null)?.name ?? null,
  }));

  // A stylist with no services or no roster cannot take a booking, and that is
  // easy to create by accident — so it is stated rather than left to be found.
  const unbookable = records.filter(
    (r) => r.isActive && r.isBookable && r.serviceIds.length === 0,
  );

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Stylists</h2>
      <p className="mb-8 max-w-[680px] text-[15px] leading-[1.7] text-muted">
        Who works here, what they do, and whether customers can book them. Their
        working week lives in{" "}
        <Link href="/studio/availability" className="text-moss underline">
          availability
        </Link>
        ; their public profile is at <code className="text-[13px]">/stylists</code>.
      </p>

      {unbookable.length > 0 && (
        <div className="mb-8 rounded-[6px] border border-gold px-5 py-4">
          <h3 className="mb-1 text-[15px] font-semibold">
            {unbookable.length} stylist{unbookable.length === 1 ? "" : "s"} cannot
            take a booking
          </h3>
          <p className="text-[14px] leading-[1.7] text-muted">
            {unbookable.map((s) => s.displayName).join(", ")} — marked bookable
            but offering no services, so nothing shows for them on the booking
            page. Tick their services below.
          </p>
        </div>
      )}

      <StaffEditor staff={records} services={serviceOptions} />
    </div>
  );
}
