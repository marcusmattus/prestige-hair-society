import { describe, expect, it } from "vitest";
import {
  PROGRAMMES,
  findProgramme,
  getTier,
  hasMonthly,
  chargeableAmount,
  paymentSummary,
  pence,
  poundsLabel,
} from "./memberships";

describe("money helpers", () => {
  it("converts pounds to pence, rounding decimals", () => {
    expect(pence(297)).toBe(29700);
    expect(pence(148.33)).toBe(14833);
    expect(pence(212.5)).toBe(21250);
  });

  it("labels whole pounds without decimals and pence with them", () => {
    expect(poundsLabel(297)).toBe("£297");
    expect(poundsLabel(148.33)).toBe("£148.33");
    expect(poundsLabel(212.5)).toBe("£212.50");
  });
});

describe("programme catalogue matches the brief", () => {
  it("prices the Cleanse & Sculpt tiers correctly", () => {
    const p = findProgramme("cleanse-sculpt-quarterly-reset")!;
    expect(p.visits).toBe(6);
    expect(getTier(p, "short")).toMatchObject({ upfront: 297, value: 330, saving: 33, monthly: { amount: 105, months: 3 } });
    expect(getTier(p, "medium").upfront).toBe(350);
    expect(getTier(p, "long").monthly).toEqual({ amount: 145, months: 3 });
  });

  it("offers monthly on the Silk Club and scalp detox, not on the pay-in-full programmes", () => {
    expect(hasMonthly(findProgramme("texture-release-longevity-silk-club")!)).toBe(true);
    expect(hasMonthly(findProgramme("healthy-scalp-growth-detox")!)).toBe(true);
    expect(hasMonthly(findProgramme("ultimate-transitioning-restorative-journey")!)).toBe(false);
    expect(hasMonthly(findProgramme("bio-pilixin-cellular-restore-program")!)).toBe(false);
  });

  it("keeps the Bio-Pilixin cosmetic disclaimer", () => {
    const p = findProgramme("bio-pilixin-cellular-restore-program")!;
    expect(p.disclaimer).toMatch(/cosmetic/i);
    expect(p.disclaimer).toMatch(/no hair-loss cure or guaranteed regrowth/i);
  });

  it("exposes exactly the five programmes, each with three tiers", () => {
    expect(PROGRAMMES).toHaveLength(5);
    for (const p of PROGRAMMES) expect(p.tiers.map((t) => t.tier)).toEqual(["short", "medium", "long"]);
  });
});

describe("chargeable amount & payment summary", () => {
  const detox = findProgramme("healthy-scalp-growth-detox")!;
  const short = getTier(detox, "short");

  it("charges the instalment amount for monthly and the upfront for full", () => {
    expect(chargeableAmount(short, "monthly")).toBe(212.5);
    expect(chargeableAmount(short, "full")).toBe(425);
  });

  it("falls back to full when a tier has no monthly plan", () => {
    const transition = getTier(findProgramme("ultimate-transitioning-restorative-journey")!, "short");
    expect(chargeableAmount(transition, "monthly")).toBe(transition.upfront);
  });

  it("summarises the payment option", () => {
    expect(paymentSummary(short, "monthly")).toBe("£212.50/month × 2");
    expect(paymentSummary(short, "full")).toBe("£425 upfront");
  });
});
