import { enforceRateLimit, fail, ok } from "@/lib/api";
import { getAvailableSlots } from "@/lib/salon";
import { createClient } from "@/lib/supabase/server";
import { availabilityQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?serviceId=&from=&to=&staffId=&addonIds=
 *
 * Public and read-only. Returns bookable slots so the date-and-time step can
 * render; nothing is reserved until POST /api/holds.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "availability", {
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: url.searchParams.get("serviceId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    staffId: url.searchParams.get("staffId") || undefined,
    addonIds: url.searchParams.getAll("addonIds"),
  });

  if (!parsed.success) {
    return fail(422, "validation_failed", "Check the availability query parameters.");
  }

  const { serviceId, from, to, staffId, addonIds } = parsed.data;

  // Cap the span so one request cannot ask for a year of slots.
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (Number.isNaN(days) || days < 0 || days > 62) {
    return fail(422, "range_too_wide", "Ask for at most 62 days at a time.");
  }

  // Add-on minutes lengthen the appointment, which changes what fits.
  let extraMinutes = 0;
  if (addonIds.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("service_addons")
      .select("duration_minutes")
      .in("id", addonIds)
      .eq("is_active", true);
    extraMinutes = (data ?? []).reduce((sum, a) => sum + a.duration_minutes, 0);
  }

  const slots = await getAvailableSlots({ serviceId, from, to, staffId, extraMinutes });

  return ok(
    { slots },
    {
      headers: {
        // Short cache: availability moves, but a burst of identical requests
        // during a page load should not each hit the database.
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
