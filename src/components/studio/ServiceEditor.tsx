"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { formatPence, formatPrice, parsePence, penceToPoundsInput } from "@/lib/money";
import { saveServiceAction, type ActionResult } from "@/lib/studio/actions";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Service = Tables<"services">;
type Category = { id: string; name: string };

export function ServiceEditor({
  services,
  categories,
  eligibility,
}: {
  services: Service[];
  categories: Category[];
  eligibility: Record<string, number>;
}) {
  const [selectedId, setSelectedId] = useState(services[0]?.id ?? null);
  const selected = services.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ul className="max-h-[70vh] overflow-y-auto rounded-[6px] border border-line">
        {services.map((s) => {
          const stylists = eligibility[s.id] ?? 0;
          return (
            <li key={s.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                aria-current={s.id === selectedId ? "true" : undefined}
                className={cn(
                  "w-full cursor-pointer px-4 py-3 text-left transition-colors",
                  s.id === selectedId ? "bg-sand" : "hover:bg-sand/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px]">{s.name}</span>
                  <span className="shrink-0 text-[13px] text-moss">
                    {formatPrice(s.base_price_pence, s.pricing_mode)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-muted">
                  <span>{s.duration_minutes} min</span>
                  {!s.is_active && <span className="text-gold">· hidden</span>}
                  {stylists === 0 && (
                    <span className="text-[#B4483C]">· no stylist assigned</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <ServiceForm
          key={selected.id}
          service={selected}
          categories={categories}
          stylistCount={eligibility[selected.id] ?? 0}
        />
      ) : (
        <p className="rounded-[6px] border border-line px-5 py-6 text-[15px] text-muted">
          No services yet. Run supabase/seed.sql, or import the verified
          catalogue.
        </p>
      )}
    </div>
  );
}

function ServiceForm({
  service,
  categories,
  stylistCount,
}: {
  service: Service;
  categories: Category[];
  stylistCount: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveServiceAction,
    null,
  );
  const [price, setPrice] = useState(penceToPoundsInput(service.base_price_pence));
  const [deposit, setDeposit] = useState(penceToPoundsInput(service.deposit_pence));

  const priceP = parsePence(price);
  const depositP = parsePence(deposit);
  const depositTooBig = priceP !== null && depositP !== null && depositP > priceP;

  return (
    <form action={action} className="rounded-[6px] border border-line px-5 py-5">
      <input type="hidden" name="serviceId" value={service.id} />

      <h2 className="mb-5 font-serif text-[24px]">{service.name}</h2>

      {stylistCount === 0 && (
        <p className="mb-5 rounded-[4px] border border-[#B4483C] px-3 py-2 text-[13px] leading-[1.5] text-[#B4483C]">
          No stylist is set up for this service, so it cannot be booked. Assign
          one under Stylists.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Name">
          <Input name="name" defaultValue={service.name} required />
        </Labelled>
        <Labelled label="Web address" hint={`/services/${service.slug}`}>
          <Input name="slug" defaultValue={service.slug} required />
        </Labelled>
        <Labelled label="Category">
          <Select name="categoryId" defaultValue={service.category_id ?? ""}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Labelled>
        <Labelled label="Order on the site">
          <Input
            name="displayOrder"
            type="number"
            min={0}
            defaultValue={service.display_order}
          />
        </Labelled>
      </div>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
          Money
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Labelled
            label="Price (£)"
            hint={priceP !== null ? `stored as ${priceP}p` : "not a valid amount"}
          >
            <Input
              name="basePrice"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              required
            />
          </Labelled>
          <Labelled label="Pricing">
            <Select name="pricingMode" defaultValue={service.pricing_mode}>
              <option value="fixed">Exact price</option>
              <option value="from">From this price</option>
            </Select>
          </Labelled>
          <Labelled
            label="Deposit (£)"
            hint={
              depositTooBig
                ? "more than the price"
                : depositP !== null
                  ? `balance ${formatPence(Math.max(0, (priceP ?? 0) - depositP))} in salon`
                  : undefined
            }
          >
            <Input
              name="deposit"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              inputMode="decimal"
              invalid={depositTooBig}
              required
            />
          </Labelled>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
          Timing
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Labelled label="Chair time (min)">
            <Input
              name="durationMinutes"
              type="number"
              min={5}
              max={600}
              defaultValue={service.duration_minutes}
              required
            />
          </Labelled>
          <Labelled
            label="Buffer (min)"
            hint="Cleanup or processing. Blocks the stylist but is not billed."
          >
            <Input
              name="bufferMinutes"
              type="number"
              min={0}
              max={240}
              defaultValue={service.buffer_minutes}
              required
            />
          </Labelled>
          <Labelled label="Rebook after (days)" hint="Blank for no reminder.">
            <Input
              name="rebookingIntervalDays"
              type="number"
              min={1}
              max={365}
              defaultValue={service.rebooking_interval_days ?? ""}
            />
          </Labelled>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
          What the client reads
        </legend>
        <div className="grid gap-4">
          <Labelled label="Short description" hint="Shown on the catalogue card.">
            <Input
              name="shortDescription"
              defaultValue={service.short_description ?? ""}
              maxLength={300}
            />
          </Labelled>
          <Labelled label="Full description">
            <Textarea name="description" rows={4} defaultValue={service.description} />
          </Labelled>
          <Labelled label="Before you come" hint="Included in the confirmation email.">
            <Textarea
              name="preparationInstructions"
              rows={2}
              defaultValue={service.preparation_instructions ?? ""}
            />
          </Labelled>
          <Labelled label="Aftercare" hint="Included in the thank-you email.">
            <Textarea
              name="aftercareInstructions"
              rows={2}
              defaultValue={service.aftercare_instructions ?? ""}
            />
          </Labelled>
        </div>
      </fieldset>

      <fieldset className="mt-6 grid gap-3 border-t border-line pt-5">
        <legend className="sr-only">Visibility</legend>
        <Toggle name="isActive" defaultChecked={service.is_active} label="Bookable on the site" />
        <Toggle
          name="isFeatured"
          defaultChecked={service.is_featured}
          label="Feature on the homepage"
        />
        <Toggle
          name="requiresConsultation"
          defaultChecked={service.requires_consultation}
          label="Needs a consultation first"
        />
      </fieldset>

      {state?.error && (
        <p role="alert" className="mt-5 text-[14px] text-[#B4483C]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mt-5 text-[14px] text-moss">
          {state.message}
        </p>
      )}

      <Button type="submit" className="mt-6" disabled={pending || depositTooBig}>
        {pending ? "Saving…" : "Save service"}
      </Button>
    </form>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-[18px] w-[18px] accent-ink"
      />
      {label}
    </label>
  );
}
