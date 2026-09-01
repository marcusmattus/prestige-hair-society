"use client";

import type { BookableService, Staff } from "@/lib/salon";

/**
 * Booking flow state.
 *
 * A reducer rather than a pile of useState calls, because the transitions
 * matter: choosing a different service must clear the stylist and slot that
 * were valid for the old one, and releasing a hold must not leave the UI
 * showing a countdown.
 */

export type Step = "service" | "stylist" | "datetime" | "details" | "payment";

export const STEP_ORDER: Step[] = ["service", "stylist", "datetime", "details", "payment"];

export const STEP_LABELS: Record<Step, string> = {
  service: "Service",
  stylist: "Stylist",
  datetime: "Date & time",
  details: "Details",
  payment: "Payment",
};

export type Hold = {
  token: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
};

export type BookingState = {
  step: Step;
  serviceId: string | null;
  addonIds: string[];
  /** null means "any available stylist". */
  staffId: string | null;
  anyStylist: boolean;
  slotStart: string | null;
  slotStaffId: string | null;
  hold: Hold | null;
  bookingId: string | null;
  reference: string | null;
  clientSecret: string | null;
  error: string | null;
  busy: boolean;
};

export const initialState: BookingState = {
  step: "service",
  serviceId: null,
  addonIds: [],
  staffId: null,
  anyStylist: true,
  slotStart: null,
  slotStaffId: null,
  hold: null,
  bookingId: null,
  reference: null,
  clientSecret: null,
  error: null,
  busy: false,
};

export type Action =
  | { type: "selectService"; serviceId: string }
  | { type: "toggleAddon"; addonId: string }
  | { type: "selectStylist"; staffId: string | null }
  | { type: "selectSlot"; startsAt: string; staffId: string }
  | { type: "clearSlot" }
  | { type: "holdPlaced"; hold: Hold }
  | { type: "holdReleased" }
  | { type: "bookingCreated"; bookingId: string; reference: string }
  | { type: "paymentReady"; clientSecret: string }
  | { type: "goTo"; step: Step }
  | { type: "back" }
  | { type: "setBusy"; busy: boolean }
  | { type: "setError"; error: string | null };

export function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case "selectService":
      // A new service invalidates everything downstream.
      if (state.serviceId === action.serviceId) return { ...state, error: null };
      return {
        ...state,
        serviceId: action.serviceId,
        addonIds: [],
        staffId: null,
        anyStylist: true,
        slotStart: null,
        slotStaffId: null,
        hold: null,
        error: null,
      };

    case "toggleAddon": {
      const has = state.addonIds.includes(action.addonId);
      return {
        ...state,
        // Add-ons change the length, so a chosen slot may no longer fit.
        slotStart: null,
        slotStaffId: null,
        hold: null,
        addonIds: has
          ? state.addonIds.filter((id) => id !== action.addonId)
          : [...state.addonIds, action.addonId],
      };
    }

    case "selectStylist":
      return {
        ...state,
        staffId: action.staffId,
        anyStylist: action.staffId === null,
        slotStart: null,
        slotStaffId: null,
        hold: null,
        error: null,
      };

    case "selectSlot":
      return {
        ...state,
        slotStart: action.startsAt,
        slotStaffId: action.staffId,
        error: null,
      };

    case "clearSlot":
      return { ...state, slotStart: null, slotStaffId: null, hold: null };

    case "holdPlaced":
      return { ...state, hold: action.hold, step: "details", error: null, busy: false };

    case "holdReleased":
      return { ...state, hold: null, slotStart: null, slotStaffId: null, step: "datetime" };

    case "bookingCreated":
      return {
        ...state,
        bookingId: action.bookingId,
        reference: action.reference,
        step: "payment",
        busy: false,
        error: null,
      };

    case "paymentReady":
      return { ...state, clientSecret: action.clientSecret, busy: false };

    case "goTo":
      return { ...state, step: action.step, error: null };

    case "back": {
      const index = STEP_ORDER.indexOf(state.step);
      if (index <= 0) return state;
      return { ...state, step: STEP_ORDER[index - 1], error: null };
    }

    case "setBusy":
      return { ...state, busy: action.busy };

    case "setError":
      return { ...state, error: action.error, busy: false };

    default:
      return state;
  }
}

/** Which steps the customer may jump back to, given what they have chosen. */
export function reachableSteps(state: BookingState): Step[] {
  const reachable: Step[] = ["service"];
  if (state.serviceId) reachable.push("stylist");
  if (state.serviceId) reachable.push("datetime");
  if (state.hold) reachable.push("details");
  // Payment is never jumped back into: the intent is created on arrival.
  return reachable;
}

export function findService(
  services: BookableService[],
  id: string | null,
): BookableService | null {
  return services.find((s) => s.id === id) ?? null;
}

export function eligibleStaff(service: BookableService | null, staff: Staff[]): Staff[] {
  if (!service) return [];
  return staff.filter((s) => service.staffIds.includes(s.id));
}

/** Total price in pence: service plus chosen add-ons. */
export function totalPence(service: BookableService | null, addonIds: string[]): number {
  if (!service) return 0;
  return (
    service.base_price_pence +
    service.addons
      .filter((a) => addonIds.includes(a.id))
      .reduce((sum, a) => sum + a.price_pence, 0)
  );
}

/** Total minutes: service plus chosen add-ons (excluding buffer). */
export function totalMinutes(service: BookableService | null, addonIds: string[]): number {
  if (!service) return 0;
  return (
    service.duration_minutes +
    service.addons
      .filter((a) => addonIds.includes(a.id))
      .reduce((sum, a) => sum + a.duration_minutes, 0)
  );
}
