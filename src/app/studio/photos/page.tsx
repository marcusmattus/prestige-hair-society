import type { Metadata } from "next";
import Link from "next/link";
import { PhotoSlot, type SlotState } from "@/components/studio/PhotoSlot";
import { requireManager } from "@/lib/auth/roles";
import { GALLERY_SLOTS, gallerySlot, SLOTS, stylistSlot } from "@/lib/images";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  await requireManager("/studio/photos");
  const supabase = createAdminClient();

  const [{ data: images }, { data: staff }] = await Promise.all([
    supabase.from("site_images").select("*"),
    supabase
      .from("staff")
      .select("slug, display_name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
  ]);

  const bySlot = new Map((images ?? []).map((row) => [row.slot, row]));

  const build = (slot: string, label: string, hint: string): SlotState => {
    const row = bySlot.get(slot);
    return {
      slot,
      label,
      hint,
      url: row?.url ?? null,
      alt: row?.alt ?? "",
      caption: row?.caption ?? null,
      focalX: row?.focal_x ?? 50,
      focalY: row?.focal_y ?? 50,
    };
  };

  const pageSlots = Object.values(SLOTS).map((s) => build(s.key, s.label, s.hint));

  const stylistSlots = (staff ?? []).map((person) =>
    build(
      stylistSlot(person.slug),
      person.display_name,
      "Portrait orientation. Shown on the homepage, the stylists page and their own profile.",
    ),
  );

  const gallerySlots = Array.from({ length: GALLERY_SLOTS }, (_, i) =>
    build(
      gallerySlot(i + 1),
      `Salon photo ${i + 1}`,
      "Shown in the salon section of the gallery page. Fill as many as you have.",
    ),
  );

  const filled = [...pageSlots, ...stylistSlots, ...gallerySlots].filter((s) => s.url).length;
  const total = pageSlots.length + stylistSlots.length + gallerySlots.length;

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Photos</h2>
      <p className="mb-6 max-w-[680px] text-[15px] leading-[1.7] text-muted">
        Every photograph on the public site. A slot with nothing in it keeps its
        striped placeholder, so you can add them one at a time and the site is
        never half-finished — {filled} of {total} filled.
      </p>

      <div className="mb-10 rounded-[6px] border border-line bg-sand px-6 py-5">
        <h3 className="mb-2 text-[13px] tracking-[0.12em] text-sage uppercase">
          Two ways to add one
        </h3>
        <p className="mb-2 text-[14px] leading-[1.7] text-muted">
          <strong className="text-ink">Upload a file</strong> — the usual route.
          Needs the <code>site-images</code> storage bucket in Supabase; if it
          does not exist yet the upload says so.
        </p>
        <p className="text-[14px] leading-[1.7] text-muted">
          <strong className="text-ink">Use a path</strong> — for photographs
          committed to the repository. Drop them in{" "}
          <code>public/photos/</code> and enter{" "}
          <code>/photos/whatever.jpg</code>. This needs nothing configured at
          all, and is the route to use before Supabase Storage is set up.
        </p>
      </div>

      <section className="mb-10">
        <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Main pages
        </h3>
        <ul className="grid gap-3">
          {pageSlots.map((state) => (
            <PhotoSlot key={state.slot} state={state} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Stylist portraits
        </h3>
        {stylistSlots.length === 0 ? (
          <p className="text-[15px] text-muted">
            No stylists yet — add one in{" "}
            <Link href="/studio/stylists" className="text-moss underline">
              stylists
            </Link>{" "}
            and a portrait slot appears here.
          </p>
        ) : (
          <ul className="grid gap-3">
            {stylistSlots.map((state) => (
              <PhotoSlot key={state.slot} state={state} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Salon photography
        </h3>
        <p className="mb-4 max-w-[620px] text-[14px] leading-[1.7] text-muted">
          Shown on the gallery page above the before-and-after set. These are
          photographs of the salon, so they need no client consent — before and
          after work is uploaded against a client record instead.
        </p>
        <ul className="grid gap-3">
          {gallerySlots.map((state) => (
            <PhotoSlot key={state.slot} state={state} />
          ))}
        </ul>
      </section>
    </div>
  );
}
