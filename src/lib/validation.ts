import { z } from "zod";

/**
 * Every request body crossing an API boundary is parsed through one of these.
 *
 * Note what is absent: no schema accepts a price, a duration or a booking
 * status from the client. Those are derived server-side from the catalogue,
 * so a tampered payload cannot change what is owed or how long a chair is held.
 */

export const uuid = z.string().uuid();

/** UK-friendly but permissive; normalised to E.164 before it reaches Twilio. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a mobile number")
  .max(20)
  .regex(/^\+?[0-9 ()-]+$/, "Enter a valid mobile number");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80)
  // Reject control characters and anything that reads as markup.
  .regex(/^[^<>{}\\]+$/, "Remove any special characters");

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export const availabilityQuerySchema = z.object({
  serviceId: uuid,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd"),
  staffId: uuid.optional(),
  addonIds: z.array(uuid).max(10).default([]),
});

export const holdSlotSchema = z.object({
  serviceId: uuid,
  staffId: uuid,
  startsAt: z.string().datetime({ offset: true }),
  addonIds: z.array(uuid).max(10).default([]),
});

export const customerDetailsSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  hairGoals: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  accessibilityRequirements: z.string().trim().max(2000).optional().or(z.literal("")),
  marketingEmail: z.boolean().default(false),
  marketingSms: z.boolean().default(false),
  acceptedPolicy: z.literal(true, {
    message: "You must accept the cancellation policy to continue",
  }),
});

export const createBookingSchema = z.object({
  holdToken: uuid,
  details: customerDetailsSchema,
  addonIds: z.array(uuid).max(10).default([]),
  discountCode: z.string().trim().max(40).optional().or(z.literal("")),
});

export const rescheduleSchema = z.object({
  bookingId: uuid,
  staffId: uuid,
  startsAt: z.string().datetime({ offset: true }),
});

export const cancelBookingSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Waiting list
// ---------------------------------------------------------------------------

export const waitlistSchema = z
  .object({
    serviceId: uuid,
    staffId: uuid.optional(),
    earliestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    latestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timesOfDay: z
      .array(z.enum(["morning", "afternoon", "evening"]))
      .min(1, "Choose at least one time of day"),
    details: customerDetailsSchema.pick({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    }),
  })
  .refine((v) => v.latestDate >= v.earliestDate, {
    message: "The last date must be on or after the first",
    path: ["latestDate"],
  });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .regex(/[a-z]/, "Include a lower-case letter")
    .regex(/[A-Z]/, "Include an upper-case letter")
    .regex(/[0-9]/, "Include a number"),
});

export const magicLinkSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ email: emailSchema });

// ---------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  hairGoals: z.string().trim().max(2000).optional().or(z.literal("")),
  accessibilityRequirements: z.string().trim().max(2000).optional().or(z.literal("")),
  allergies: z.string().trim().max(2000).optional().or(z.literal("")),
  favouriteStaffId: uuid.optional().or(z.literal("")),
});

export const updatePreferencesSchema = z.object({
  marketingEmail: z.boolean(),
  marketingSms: z.boolean(),
  reminderEmail: z.boolean(),
  reminderSms: z.boolean(),
});

// ---------------------------------------------------------------------------
// Studio (staff)
// ---------------------------------------------------------------------------

export const serviceFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lower-case letters, numbers and hyphens only"),
  categoryId: uuid.optional().or(z.literal("")),
  shortDescription: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(5000).default(""),
  preparationInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
  aftercareInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  basePricePence: z.coerce.number().int().min(0),
  pricingMode: z.enum(["fixed", "from"]),
  depositPence: z.coerce.number().int().min(0),
  requiresConsultation: z.boolean().default(false),
  rebookingIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  eligibleStaffIds: z.array(uuid).default([]),
}).refine((v) => v.depositPence <= v.basePricePence, {
  message: "The deposit cannot be more than the price",
  path: ["depositPence"],
});

export const clientNoteSchema = z.object({
  profileId: uuid,
  bookingId: uuid.optional(),
  body: z.string().trim().min(1, "Write something").max(4000),
  kind: z.enum(["note", "formula", "product", "complaint"]).default("note"),
});

export const manualBookingSchema = z.object({
  profileId: uuid.optional(),
  newCustomer: customerDetailsSchema
    .pick({ firstName: true, lastName: true, email: true, phone: true })
    .optional(),
  serviceId: uuid,
  staffId: uuid,
  startsAt: z.string().datetime({ offset: true }),
  addonIds: z.array(uuid).max(10).default([]),
  isWalkIn: z.boolean().default(false),
  internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
}).refine((v) => v.profileId || v.newCustomer, {
  message: "Choose an existing client or enter a new one",
  path: ["profileId"],
});

export const recordPaymentSchema = z.object({
  bookingId: uuid,
  amountPence: z.coerce.number().int().min(1),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const refundSchema = z.object({
  paymentId: uuid,
  amountPence: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1, "Give a reason").max(500),
});

export const timeOffSchema = z
  .object({
    staffId: uuid,
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "The end must be after the start",
    path: ["endsAt"],
  });

export const salonSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(3).max(12),
  phone: phoneSchema.optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  timezone: z.string().min(1).max(64),
  bookingWindowDays: z.coerce.number().int().min(1).max(365),
  minNoticeMinutes: z.coerce.number().int().min(0).max(20160),
  cancellationWindowHours: z.coerce.number().int().min(0).max(336),
  rescheduleWindowHours: z.coerce.number().int().min(0).max(336),
  slotIntervalMinutes: z.coerce.number().int().refine(
    (v) => [5, 10, 15, 20, 30, 60].includes(v),
    "Choose 5, 10, 15, 20, 30 or 60 minutes",
  ),
  holdDurationMinutes: z.coerce.number().int().min(1).max(60),
  depositRequired: z.boolean(),
  allowFullPayment: z.boolean(),
});

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;
export type ServiceForm = z.infer<typeof serviceFormSchema>;
export type ManualBooking = z.infer<typeof manualBookingSchema>;
