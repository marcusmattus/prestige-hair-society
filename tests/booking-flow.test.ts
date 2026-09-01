import { describe, expect, it } from "vitest";
import {
  initialState,
  reachableSteps,
  reducer,
  totalMinutes,
  totalPence,
  type BookingState,
} from "@/components/booking/flow-state";
import type { BookableService } from "@/lib/salon";

const addon = (id: string, price: number, minutes: number) =>
  ({
    id,
    salon_id: "salon",
    name: `Addon ${id}`,
    slug: id,
    description: null,
    duration_minutes: minutes,
    price_pence: price,
    display_order: 0,
    is_active: true,
    deleted_at: null,
    created_at: "",
    updated_at: "",
  }) as BookableService["addons"][number];

const service = {
  id: "silk",
  name: "Silk Press",
  duration_minutes: 90,
  buffer_minutes: 15,
  base_price_pence: 8500,
  deposit_pence: 3000,
  pricing_mode: "fixed",
  addons: [addon("bond", 2500, 15), addon("scalp", 2000, 20)],
  staffIds: ["amara", "rebecca"],
} as unknown as BookableService;

describe("pricing and duration", () => {
  it("is the service alone when no add-ons are chosen", () => {
    expect(totalPence(service, [])).toBe(8500);
    expect(totalMinutes(service, [])).toBe(90);
  });

  it("adds each chosen add-on", () => {
    expect(totalPence(service, ["bond"])).toBe(11000);
    expect(totalMinutes(service, ["bond"])).toBe(105);
    expect(totalPence(service, ["bond", "scalp"])).toBe(13000);
    expect(totalMinutes(service, ["bond", "scalp"])).toBe(125);
  });

  it("ignores an add-on id that is not attached to this service", () => {
    expect(totalPence(service, ["not-a-real-addon"])).toBe(8500);
  });

  it("is zero with no service", () => {
    expect(totalPence(null, ["bond"])).toBe(0);
    expect(totalMinutes(null, [])).toBe(0);
  });
});

describe("flow transitions", () => {
  const chosen: BookingState = {
    ...initialState,
    step: "datetime",
    serviceId: "silk",
    addonIds: ["bond"],
    staffId: "amara",
    anyStylist: false,
    slotStart: "2026-07-15T09:00:00Z",
    slotStaffId: "amara",
  };

  it("clears everything downstream when the service changes", () => {
    // A stylist and slot valid for Silk Press may be invalid for Colour.
    const next = reducer(chosen, { type: "selectService", serviceId: "colour" });
    expect(next.serviceId).toBe("colour");
    expect(next.addonIds).toEqual([]);
    expect(next.staffId).toBeNull();
    expect(next.anyStylist).toBe(true);
    expect(next.slotStart).toBeNull();
    expect(next.hold).toBeNull();
  });

  it("keeps the selection when the same service is re-chosen", () => {
    const next = reducer(chosen, { type: "selectService", serviceId: "silk" });
    expect(next.slotStart).toBe(chosen.slotStart);
    expect(next.addonIds).toEqual(["bond"]);
  });

  it("clears the slot when add-ons change, because the length changes", () => {
    const next = reducer(chosen, { type: "toggleAddon", addonId: "scalp" });
    expect(next.addonIds).toEqual(["bond", "scalp"]);
    expect(next.slotStart).toBeNull();
    expect(next.hold).toBeNull();
  });

  it("removes an add-on that was already chosen", () => {
    const next = reducer(chosen, { type: "toggleAddon", addonId: "bond" });
    expect(next.addonIds).toEqual([]);
  });

  it("clears the slot when the stylist changes", () => {
    const next = reducer(chosen, { type: "selectStylist", staffId: "rebecca" });
    expect(next.staffId).toBe("rebecca");
    expect(next.anyStylist).toBe(false);
    expect(next.slotStart).toBeNull();
  });

  it("treats a null stylist as 'any available'", () => {
    const next = reducer(chosen, { type: "selectStylist", staffId: null });
    expect(next.anyStylist).toBe(true);
    expect(next.staffId).toBeNull();
  });

  it("moves to details once a hold is placed", () => {
    const hold = {
      token: "t",
      startsAt: "2026-07-15T09:00:00Z",
      endsAt: "2026-07-15T10:30:00Z",
      expiresAt: "2026-07-15T08:10:00Z",
    };
    const next = reducer(chosen, { type: "holdPlaced", hold });
    expect(next.step).toBe("details");
    expect(next.hold).toEqual(hold);
    expect(next.busy).toBe(false);
  });

  it("sends the customer back to pick a time when a hold is lost", () => {
    const held = reducer(chosen, {
      type: "holdPlaced",
      hold: { token: "t", startsAt: "", endsAt: "", expiresAt: "" },
    });
    const next = reducer(held, { type: "holdReleased" });
    expect(next.step).toBe("datetime");
    expect(next.hold).toBeNull();
    expect(next.slotStart).toBeNull();
  });

  it("does not step back past the first step", () => {
    const next = reducer({ ...initialState, step: "service" }, { type: "back" });
    expect(next.step).toBe("service");
  });

  it("clears the error on every navigation", () => {
    const errored = reducer(chosen, { type: "setError", error: "boom" });
    expect(errored.error).toBe("boom");
    expect(reducer(errored, { type: "back" }).error).toBeNull();
    expect(reducer(errored, { type: "goTo", step: "service" }).error).toBeNull();
  });
});

describe("reachable steps", () => {
  it("offers only the service step at the start", () => {
    expect(reachableSteps(initialState)).toEqual(["service"]);
  });

  it("opens up as choices are made", () => {
    const withService: BookingState = { ...initialState, serviceId: "silk" };
    expect(reachableSteps(withService)).toContain("stylist");
    expect(reachableSteps(withService)).toContain("datetime");
    expect(reachableSteps(withService)).not.toContain("details");
  });

  it("never offers a jump back into payment", () => {
    const paying: BookingState = {
      ...initialState,
      serviceId: "silk",
      step: "payment",
      hold: { token: "t", startsAt: "", endsAt: "", expiresAt: "" },
      bookingId: "b",
    };
    // Re-entering payment would create a second PaymentIntent.
    expect(reachableSteps(paying)).not.toContain("payment");
  });
});
