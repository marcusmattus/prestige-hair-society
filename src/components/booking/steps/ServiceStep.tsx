"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/field";
import { formatPrice } from "@/lib/money";
import type { BookableService, ServiceCategory } from "@/lib/salon";
import { formatDurationShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ServiceStep({
  categories,
  services,
  selectedId,
  addonIds,
  onSelect,
  onToggleAddon,
}: {
  categories: ServiceCategory[];
  services: BookableService[];
  selectedId: string | null;
  addonIds: string[];
  onSelect: (serviceId: string) => void;
  onToggleAddon: (addonId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const selected = services.find((s) => s.id === selectedId) ?? null;

  const visible = categoryId
    ? services.filter((s) => s.category_id === categoryId)
    : services;

  // Only offer categories that actually have a bookable service in them.
  const usableCategories = categories.filter((c) =>
    services.some((s) => s.category_id === c.id),
  );

  return (
    <div>
      <h2 className="mb-1 font-serif text-[30px] font-light md:text-[36px]">
        What are you booking?
      </h2>
      <p className="mb-7 text-[15px] text-muted">
        Prices are a starting point where a service is marked “from”. Your final
        price is confirmed in the salon.
      </p>

      {usableCategories.length > 1 && (
        <div
          role="group"
          aria-label="Filter by category"
          className="mb-6 flex flex-wrap gap-2"
        >
          <FilterChip active={categoryId === null} onClick={() => setCategoryId(null)}>
            All
          </FilterChip>
          {usableCategories.map((c) => (
            <FilterChip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}

      <ul className="grid gap-3">
        {visible.map((service) => {
          const active = service.id === selectedId;
          return (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => onSelect(service.id)}
                aria-pressed={active}
                className={cn(
                  "w-full cursor-pointer rounded-[6px] border px-5 py-5 text-left transition-colors",
                  active ? "border-ink bg-sand" : "border-line bg-cream hover:border-gold",
                )}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-[22px]">{service.name}</span>
                  <span className="shrink-0 text-[14px] text-moss">
                    {formatPrice(service.base_price_pence, service.pricing_mode)}
                  </span>
                </div>
                {service.short_description && (
                  <p className="mt-2 text-[14px] leading-[1.6] text-muted">
                    {service.short_description}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                  <span>{formatDurationShort(service.duration_minutes)}</span>
                  {service.deposit_pence > 0 && (
                    <span>{formatPrice(service.deposit_pence)} deposit</span>
                  )}
                  {service.requires_consultation && (
                    <span className="text-gold">Consultation required</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {selected?.preparation_instructions && (
        <div className="mt-6 rounded-[6px] border border-line bg-sand px-5 py-4">
          <h3 className="mb-1.5 text-[13px] tracking-[0.12em] text-sage uppercase">
            Before you come
          </h3>
          <p className="text-[14px] leading-[1.6] text-muted">
            {selected.preparation_instructions}
          </p>
        </div>
      )}

      {selected && selected.addons.length > 0 && (
        <fieldset className="mt-7">
          <legend className="mb-3.5 text-[13px] tracking-[0.12em] text-sage uppercase">
            Add to your appointment
          </legend>
          <div className="grid gap-2.5">
            {selected.addons.map((addon) => (
              <div
                key={addon.id}
                className="flex items-start justify-between gap-4 rounded-[6px] border border-line px-4 py-3.5"
              >
                <Checkbox
                  checked={addonIds.includes(addon.id)}
                  onCheckedChange={() => onToggleAddon(addon.id)}
                  label={
                    <span>
                      <span className="block text-[14px] text-ink">{addon.name}</span>
                      {addon.description && (
                        <span className="block text-[13px] text-muted">
                          {addon.description}
                        </span>
                      )}
                    </span>
                  }
                />
                <span className="shrink-0 text-right text-[13px] text-moss">
                  {formatPrice(addon.price_pence)}
                  {addon.duration_minutes > 0 && (
                    <span className="block text-muted">+{addon.duration_minutes} min</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-[44px] cursor-pointer rounded-[4px] border px-4 py-2 text-[13px] transition-colors",
        active ? "border-ink bg-ink text-sand" : "border-line text-ink hover:border-gold",
      )}
    >
      {children}
    </button>
  );
}
