import type { Metadata } from "next";
import { ServiceEditor } from "@/components/studio/ServiceEditor";
import { requireManager } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Studio — services",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The catalogue, editable.
 *
 * This is what makes the placeholder prices replaceable without a deploy,
 * which the Slick import depends on. Manager and admin only: a price change
 * is immediately visible to every customer and affects what is charged.
 */
export default async function StudioServicesPage() {
  await requireManager("/studio/services");
  const supabase = await createClient();

  const [{ data: services }, { data: categories }, { data: counts }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("service_categories")
      .select("id, name")
      .is("deleted_at", null)
      .order("display_order"),
    supabase.from("staff_services").select("service_id"),
  ]);

  // A service nobody can perform is not bookable, however good the copy is.
  const eligibility = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.service_id] = (acc[row.service_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light">Services</h1>
        <p className="mt-1 max-w-[640px] text-[15px] leading-[1.7] text-muted">
          Prices, durations and instructions. Changes appear on the public site
          within five minutes; appointments already booked keep the price they
          were booked at.
        </p>
      </div>

      <ServiceEditor
        services={services ?? []}
        categories={categories ?? []}
        eligibility={eligibility}
      />
    </div>
  );
}
