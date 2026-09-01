import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

/**
 * Read-side data access for the public site.
 *
 * All of these use the anon/session client, so RLS applies -- these functions
 * cannot leak a row a visitor is not entitled to. `cache()` dedupes within a
 * single render pass, so a page and its layout asking for the salon twice
 * still makes one query.
 */

export type Service = Tables<"services">;
export type Staff = Tables<"staff">;
export type ServiceCategory = Tables<"service_categories">;
export type Salon = Tables<"salons">;
export type OpeningHours = Tables<"opening_hours">;
export type ServiceAddon = Tables<"service_addons">;

export const getSalon = cache(async (): Promise<Salon | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("salons")
    .select("*")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
});

export const getOpeningHours = cache(async (): Promise<OpeningHours[]> => {
  const salon = await getSalon();
  if (!salon) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("opening_hours")
    .select("*")
    .eq("salon_id", salon.id)
    .order("day_of_week");
  return data ?? [];
});

export const getCategories = cache(async (): Promise<ServiceCategory[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("display_order");
  return data ?? [];
});

export const getServices = cache(async (): Promise<Service[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("display_order");
  return data ?? [];
});

export const getFeaturedServices = cache(async (): Promise<Service[]> => {
  return (await getServices()).filter((s) => s.is_featured);
});

export const getServiceBySlug = cache(async (slug: string): Promise<Service | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export const getStaff = cache(async (): Promise<Staff[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("display_order");
  return data ?? [];
});

export const getStaffBySlug = cache(async (slug: string): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

/** Stylists eligible to deliver a given service, in display order. */
export const getEligibleStaff = cache(async (serviceId: string): Promise<Staff[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_services")
    .select("staff:staff_id(*)")
    .eq("service_id", serviceId);

  return ((data ?? []) as unknown as { staff: Staff | null }[])
    .map((row) => row.staff)
    .filter((s): s is Staff => !!s && s.is_active && s.is_bookable && !s.deleted_at)
    .sort((a, b) => a.display_order - b.display_order);
});

/** Services a given stylist can deliver. */
export const getStaffServices = cache(async (staffId: string): Promise<Service[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_services")
    .select("service:service_id(*)")
    .eq("staff_id", staffId);

  return ((data ?? []) as unknown as { service: Service | null }[])
    .map((row) => row.service)
    .filter((s): s is Service => !!s && s.is_active && !s.deleted_at)
    .sort((a, b) => a.display_order - b.display_order);
});

/** Add-ons attachable to a service. */
export const getServiceAddons = cache(async (serviceId: string): Promise<ServiceAddon[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_addon_links")
    .select("addon:addon_id(*)")
    .eq("service_id", serviceId);

  return ((data ?? []) as unknown as { addon: ServiceAddon | null }[])
    .map((row) => row.addon)
    .filter((a): a is ServiceAddon => !!a && a.is_active && !a.deleted_at)
    .sort((a, b) => a.display_order - b.display_order);
});

/** Published before/after photography, consent-gated by RLS. */
export const getGallery = cache(async (limit = 12) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_photos")
    .select("id, storage_path, kind, caption, service_id, created_at")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
});

export type BookableService = Service & {
  addons: ServiceAddon[];
  staffIds: string[];
};

export type BookingCatalogue = {
  salon: Salon;
  categories: ServiceCategory[];
  services: BookableService[];
  staff: Staff[];
};

/**
 * Everything /book needs, assembled server-side in one pass.
 *
 * The alternative -- letting the client fetch eligibility and add-ons per
 * service -- turns choosing a service into a waterfall of requests. This is
 * a few hundred rows at most.
 */
export const getBookingCatalogue = cache(async (): Promise<BookingCatalogue | null> => {
  const salon = await getSalon();
  if (!salon) return null;

  const supabase = await createClient();
  const [categories, services, staff, links, addonLinks] = await Promise.all([
    getCategories(),
    getServices(),
    getStaff(),
    supabase.from("staff_services").select("staff_id, service_id"),
    supabase.from("service_addon_links").select("service_id, addon:addon_id(*)"),
  ]);

  const staffByService = new Map<string, string[]>();
  for (const link of links.data ?? []) {
    const list = staffByService.get(link.service_id) ?? [];
    list.push(link.staff_id);
    staffByService.set(link.service_id, list);
  }

  const addonsByService = new Map<string, ServiceAddon[]>();
  for (const link of addonLinks.data ?? []) {
    const addon = link.addon as ServiceAddon | null;
    if (!addon || !addon.is_active || addon.deleted_at) continue;
    const list = addonsByService.get(link.service_id) ?? [];
    list.push(addon);
    addonsByService.set(link.service_id, list);
  }

  const bookableStaff = new Set(
    staff.filter((s) => s.is_bookable).map((s) => s.id),
  );

  return {
    salon,
    categories,
    staff: staff.filter((s) => s.is_bookable),
    services: services.map((service) => ({
      ...service,
      addons: (addonsByService.get(service.id) ?? []).sort(
        (a, b) => a.display_order - b.display_order,
      ),
      staffIds: (staffByService.get(service.id) ?? []).filter((id) => bookableStaff.has(id)),
    })),
  };
});

export type AvailableSlot = {
  staff_id: string;
  staff_name: string;
  slot_start: string;
  slot_end: string;
  blocked_until: string;
};

/**
 * Bookable slots between two salon-local dates.
 *
 * Advisory only: hold_slot() re-validates before anything is reserved, so a
 * stale read here shows a slot that has just gone, never creates a clash.
 */
export async function getAvailableSlots(args: {
  serviceId: string;
  from: string;
  to: string;
  staffId?: string;
  extraMinutes?: number;
}): Promise<AvailableSlot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("available_slots", {
    p_service_id: args.serviceId,
    p_from: args.from,
    p_to: args.to,
    p_staff_id: args.staffId ?? null,
    p_extra_minutes: args.extraMinutes ?? 0,
  } as never);

  if (error) {
    console.error("[availability] rpc failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as AvailableSlot[];
}

/** The single earliest bookable slot, for the hero card and "first available". */
export async function getNextAvailableSlot(
  serviceId: string,
  staffId?: string,
): Promise<AvailableSlot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_available_slot", {
    p_service_id: serviceId,
    p_staff_id: staffId ?? null,
  } as never);

  if (error) return null;
  const rows = (data ?? []) as unknown as AvailableSlot[];
  return rows[0] ?? null;
}
