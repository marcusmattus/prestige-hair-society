"use client";

import { balanceDue, formatPence, formatPrice } from "@/lib/money";
import type { BookableService, Staff } from "@/lib/salon";
import { formatDuration, formatWhenShort } from "@/lib/time";

/** The running summary shown in the booking footer and sidebar. */
export function BookingSummary({
  service,
  addonIds,
  staff,
  anyStylist,
  slotStart,
  timezone,
  totalPence: total,
  totalMinutes: minutes,
}: {
  service: BookableService | null;
  addonIds: string[];
  staff: Staff | null;
  anyStylist: boolean;
  slotStart: string | null;
  timezone: string;
  totalPence: number;
  totalMinutes: number;
}) {
  if (!service) {
    return (
      <p className="text-[14px] text-muted">Choose a service to begin.</p>
    );
  }

  const chosenAddons = service.addons.filter((a) => addonIds.includes(a.id));
  const deposit = Math.min(service.deposit_pence, total);

  return (
    <div className="grid gap-3 text-[14px]">
      <Row label="Service" value={service.name} />
      {chosenAddons.map((addon) => (
        <Row key={addon.id} label="Add-on" value={addon.name} muted />
      ))}
      <Row label="Length" value={formatDuration(minutes)} />
      <Row
        label="Stylist"
        value={anyStylist ? "Any available stylist" : (staff?.display_name ?? "—")}
      />
      <Row
        label="When"
        value={slotStart ? formatWhenShort(slotStart, timezone) : "Not chosen yet"}
      />

      <div className="mt-1 grid gap-3 border-t border-line pt-3">
        <Row
          label="Total"
          value={formatPrice(total, service.pricing_mode)}
          emphasis
        />
        {deposit > 0 && (
          <>
            <Row label="Deposit today" value={formatPence(deposit)} />
            <Row
              label="Balance in salon"
              value={
                formatPence(balanceDue(total, deposit)) +
                (service.pricing_mode === "from" ? " onwards" : "")
              }
              muted
            />
          </>
        )}
      </div>

      {service.pricing_mode === "from" && (
        <p className="mt-1 text-[13px] leading-[1.55] text-muted">
          This service is priced from {formatPence(service.base_price_pence)}. Your
          stylist confirms the final price at your consultation.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span
        className={
          emphasis ? "text-ink" : muted ? "text-right text-muted" : "text-right text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
