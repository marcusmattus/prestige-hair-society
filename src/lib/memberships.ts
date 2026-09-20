/**
 * Prestige Hair Society memberships, subscriptions and treatment programmes.
 *
 * This is the single source of truth for the programmes shown on the site and
 * charged through Stripe. Prices are in pounds; convert to pence with
 * `pence()` at the Stripe boundary. Each programme has three hair tiers, and a
 * tier may offer a monthly instalment plan in addition to paying in full.
 */

export type Tier = "short" | "medium" | "long";

export const TIERS: Tier[] = ["short", "medium", "long"];

export const TIER_LABEL: Record<Tier, string> = {
  short: "Short / Fine",
  medium: "Medium",
  long: "Long / Thick",
};

export type PaymentOption = "full" | "monthly";

/** A fixed-count instalment plan, e.g. £105/month × 3. */
export type MonthlyPlan = { amount: number; months: number };

export type TierPricing = {
  tier: Tier;
  /** The pay-in-full price. */
  upfront: number;
  /** Optional instalment plan. Absence means pay-in-full only for this tier. */
  monthly?: MonthlyPlan;
  /** Standalone à la carte value, for the saving callout. */
  value?: number;
  /** Explicit saving figure where the brief states one. */
  saving?: number;
  /** Tier-specific inclusions, when they differ by hair length. */
  includes?: string[];
};

export type Programme = {
  id: string;
  slug: string;
  eyebrow: string;
  name: string;
  category: string;
  /** Short badge, e.g. "4 WEEK", "3 MONTH", "6 MONTH", "90 DAYS". */
  badge: string;
  /** e.g. "12 weeks • 6 appointments". */
  durationLabel: string;
  summary: string;
  /** Total included appointments, where the programme defines one. */
  visits?: number;
  /** Programme-wide inclusions shared across tiers. */
  includes?: string[];
  /** Optional visit-by-visit structure. */
  structure?: { label: string; detail: string }[];
  tiers: TierPricing[];
  cta: string;
  /** Compliance / clarifying note shown in small print. */
  disclaimer?: string;
};

export const PROGRAMMES: Programme[] = [
  {
    id: "cleanse-sculpt",
    slug: "cleanse-sculpt-quarterly-reset",
    eyebrow: "Cleanse & Sculpt",
    name: "Quarterly Reset",
    category: "Wash & Blow Dry Membership",
    badge: "3 MONTH",
    durationLabel: "12 weeks • every 2 weeks • 6 appointments",
    summary:
      "A structured bi-weekly maintenance programme combining scalp cleansing, hydration, professional blow-drying and protective finishing.",
    visits: 6,
    structure: [
      {
        label: "Visits 1, 3 & 5",
        detail:
          "Clinical Scalp Cleanse + Deep Hydration Wash + Signature Blowdry + choice of 2 protective cornrows or sleek band finish.",
      },
      {
        label: "Visits 2, 4 & 6",
        detail:
          "Maintenance Scalp Refresh + Hydration Wash + Blowdry + Protective Finish + Hair Health / Trim Assessment.",
      },
    ],
    tiers: [
      { tier: "short", upfront: 297, monthly: { amount: 105, months: 3 }, value: 330, saving: 33 },
      { tier: "medium", upfront: 350, monthly: { amount: 125, months: 3 }, value: 390, saving: 40 },
      { tier: "long", upfront: 405, monthly: { amount: 145, months: 3 }, value: 450, saving: 45 },
    ],
    cta: "Join the Quarterly Reset",
  },
  {
    id: "silk-club",
    slug: "texture-release-longevity-silk-club",
    eyebrow: "Texture Release",
    name: "Longevity & Silk Club",
    category: "6-Month Membership",
    badge: "6 MONTH",
    durationLabel: "6 months",
    summary:
      "Designed for optimal length retention and moisture balance between texture therapies — Texture Release treatments, bespoke Hydration & Nano-Steam Silk Presses and ongoing therapeutic trims.",
    tiers: [
      {
        tier: "short",
        upfront: 630,
        monthly: { amount: 105, months: 6 },
        includes: [
          "2 × Short Texture Release Therapies",
          "4 × Hydration & Nano-Steam Silk Presses",
          "Continuous Therapeutic Trims",
        ],
      },
      {
        tier: "medium",
        upfront: 750,
        monthly: { amount: 125, months: 6 },
        includes: [
          "2 × Medium Texture Release Treatments",
          "4 × Bespoke Hydration & Nano-Steam Silk Presses",
          "Continuous Therapeutic Trims",
        ],
      },
      {
        tier: "long",
        upfront: 890,
        monthly: { amount: 148.33, months: 6 },
        includes: [
          "2 × Long Texture Release Therapies",
          "4 × Hydration & Nano-Steam Silk Presses",
          "Continuous Therapeutic Trims",
        ],
      },
    ],
    cta: "Join the Silk Club",
  },
  {
    id: "transition-journey",
    slug: "ultimate-transitioning-restorative-journey",
    eyebrow: "Ultimate Transitioning",
    name: "Restorative Journey",
    category: "6-Month Restorative Programme",
    badge: "6 MONTH",
    durationLabel: "6 months • ~every 4 weeks • 6 appointments",
    summary:
      "A premium six-month care and styling programme for clients transitioning away from chemical relaxers, protecting hair integrity and reducing breakage around the line of demarcation while gradually moving toward the client's natural texture.",
    visits: 6,
    includes: [
      "Initial Transition Mapping Consultation & Hair Integrity Assessment",
      "6 appointments spaced approximately every 4 weeks",
      "Advanced Bond-Building Treatments",
      "Amino-Acid Moisture Infusions",
      "Custom Nano-Steam Therapy",
      "Luxury Silk Press or Blowout Finish",
      "3 Strategic Stretch & Trim appointments",
    ],
    tiers: [
      { tier: "short", upfront: 695, value: 770 },
      { tier: "medium", upfront: 750, value: 830 },
      { tier: "long", upfront: 795, value: 890 },
    ],
    cta: "Start My Transition Journey",
  },
  {
    id: "bio-pilixin",
    slug: "bio-pilixin-cellular-restore-program",
    eyebrow: "Bio-Pilixin®",
    name: "Cellular Restore Program",
    category: "Hair & Scalp Programme",
    badge: "90 DAYS",
    durationLabel: "90 days • 3 sessions",
    summary:
      "A structured scalp and hair-care programme combining professional in-salon treatments with a 90-day Bio-Pilixin® home-care routine.",
    visits: 3,
    includes: [
      "Full Bio-Pilixin® Trilogy Take-Home Kit (Activation Serum, Strength Shampoo, Recovery Conditioner)",
      "Digital Scalp Density Mapping",
      "Follicle Baseline Analysis",
      "3 in-salon follicular scaling sessions",
      "Scalp massage & high-absorption steam therapy",
      "Premium styling finish",
    ],
    tiers: [
      { tier: "short", upfront: 425, value: 485 },
      { tier: "medium", upfront: 455, value: 515 },
      { tier: "long", upfront: 485, value: 545 },
    ],
    cta: "Start the 90-Day Program",
    disclaimer:
      "A cosmetic scalp and hair-care programme. Not a medical treatment; no hair-loss cure or guaranteed regrowth is claimed.",
  },
  {
    id: "scalp-detox",
    slug: "healthy-scalp-growth-detox",
    eyebrow: "Healthy Scalp & Growth",
    name: "Detox Programme",
    category: "Scalp Detox Programme",
    badge: "4 WEEK",
    durationLabel: "4 weeks • 4 appointments",
    summary:
      "A four-part scalp-care programme for clients experiencing product build-up, seasonal shedding or wanting to improve their scalp-care routine.",
    visits: 4,
    includes: [
      "Advanced Digital Scalp Analysis",
      "Follicle Health Consultation",
      "4 × Botanical Pre-Scalp Detox Sessions",
      "Deep Follicular Cleansing",
      "Custom Nano-Steam Hydration",
      "Professional Styling Finish",
      "1 × targeted strengthening treatment",
    ],
    tiers: [
      { tier: "short", upfront: 425, value: 495, monthly: { amount: 212.5, months: 2 } },
      { tier: "medium", upfront: 465, value: 535, monthly: { amount: 232.5, months: 2 } },
      { tier: "long", upfront: 495, value: 575, monthly: { amount: 247.5, months: 2 } },
    ],
    cta: "Start My Scalp Reset",
  },
];

// ---------------------------------------------------------------------------
// Lookups & helpers
// ---------------------------------------------------------------------------

export function findProgramme(idOrSlug: string) {
  return PROGRAMMES.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

export function getTier(programme: Programme, tier: Tier) {
  return programme.tiers.find((t) => t.tier === tier) ?? programme.tiers[0];
}

export function hasMonthly(programme: Programme) {
  return programme.tiers.some((t) => t.monthly);
}

/** The amount charged now for a chosen tier + payment option, in pounds. */
export function chargeableAmount(pricing: TierPricing, payment: PaymentOption) {
  if (payment === "monthly" && pricing.monthly) return pricing.monthly.amount;
  return pricing.upfront;
}

/** Pence, rounded, for the Stripe boundary. */
export function pence(pounds: number) {
  return Math.round(pounds * 100);
}

/** "£297" for whole pounds, "£212.50" / "£148.33" when there are pence. */
export function poundsLabel(value: number) {
  const fraction = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
}

/** A short human description of the payment option for a tier. */
export function paymentSummary(pricing: TierPricing, payment: PaymentOption) {
  if (payment === "monthly" && pricing.monthly) {
    return `${poundsLabel(pricing.monthly.amount)}/month × ${pricing.monthly.months}`;
  }
  return `${poundsLabel(pricing.upfront)} upfront`;
}
