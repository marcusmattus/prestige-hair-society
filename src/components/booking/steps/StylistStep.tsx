"use client";

import type { Staff } from "@/lib/salon";
import { cn } from "@/lib/utils";

export function StylistStep({
  staff,
  selectedId,
  anyStylist,
  onSelect,
}: {
  staff: Staff[];
  selectedId: string | null;
  anyStylist: boolean;
  onSelect: (staffId: string | null) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 font-serif text-[30px] font-light md:text-[36px]">
        Who would you like to see?
      </h2>
      <p className="mb-7 text-[15px] text-muted">
        Choosing “any available” usually finds you an earlier appointment.
      </p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={anyStylist}
          className={cn(
            "cursor-pointer rounded-[6px] border px-5 py-5 text-left transition-colors",
            anyStylist ? "border-ink bg-sand" : "border-line bg-cream hover:border-gold",
          )}
        >
          <span className="font-serif text-[22px]">Any available stylist</span>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-muted">
            We will match you with a stylist qualified for this service.
          </p>
        </button>

        {staff.map((person) => {
          const active = !anyStylist && person.id === selectedId;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelect(person.id)}
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-[6px] border px-5 py-5 text-left transition-colors",
                active ? "border-ink bg-sand" : "border-line bg-cream hover:border-gold",
              )}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-[22px]">{person.display_name}</span>
                {person.title && (
                  <span className="shrink-0 text-[12px] tracking-[0.06em] text-gold uppercase">
                    {person.title}
                  </span>
                )}
              </div>
              {person.bio && (
                <p className="mt-2 text-[14px] leading-[1.6] text-muted">{person.bio}</p>
              )}
              {person.specialties.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {person.specialties.map((s) => (
                    <li
                      key={s}
                      className="rounded-[3px] border border-line px-2.5 py-1 text-[12px] text-muted"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {staff.length === 0 && (
        <p className="rounded-[6px] border border-line bg-sand px-5 py-4 text-[14px] text-muted">
          No stylist is currently set up for this service. Please call the salon
          and we will arrange it.
        </p>
      )}
    </div>
  );
}
