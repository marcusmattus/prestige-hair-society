"use client";

import { useBooking } from "./booking/BookingProvider";

const SIZES = {
  sm: "px-[26px] py-[13px] text-[14px] min-h-[44px]",
  md: "px-[34px] py-[17px] text-[15px] min-h-[48px]",
  lg: "px-8 py-[18px] text-[15px] min-h-[48px] sm:px-[42px]",
} as const;

/** Solid dark CTA that opens the booking drawer. */
export function BookNowButton({
  size = "md",
  children,
  className = "",
}: {
  size?: keyof typeof SIZES;
  children: React.ReactNode;
  className?: string;
}) {
  const { openBooking } = useBooking();

  return (
    <button
      type="button"
      onClick={openBooking}
      className={`cursor-pointer rounded-[4px] bg-ink tracking-[0.03em] text-sand transition-colors hover:bg-ink-hover ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Quiet text CTA used inside the hero's "next available" card. */
export function ViewAvailabilityButton() {
  const { openBooking } = useBooking();

  return (
    <button
      type="button"
      onClick={openBooking}
      className="mt-4 cursor-pointer text-[13px] tracking-[0.04em] text-moss transition-colors hover:text-gold"
    >
      View availability →
    </button>
  );
}
