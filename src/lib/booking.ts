export type Service = {
  id: string;
  name: string;
  /** Appointment length in minutes. */
  mins: number;
  /** Full price in GBP. */
  price: number;
  /** Deposit taken at booking, in GBP. */
  deposit: number;
  /** Whether the price is a starting point rather than a fixed amount. */
  from: boolean;
};

/** Placeholder catalogue — replace once the verified salon catalogue is imported. */
export const SERVICES: Service[] = [
  { id: "consult", name: "Consultation", mins: 30, price: 45, deposit: 20, from: false },
  { id: "wcf", name: "Wash, Cut & Finish", mins: 90, price: 75, deposit: 25, from: false },
  { id: "silk", name: "Silk Press", mins: 90, price: 85, deposit: 30, from: false },
  { id: "colour", name: "Colour Services", mins: 180, price: 150, deposit: 50, from: true },
  { id: "protective", name: "Protective Styling", mins: 150, price: 120, deposit: 40, from: true },
  { id: "treatment", name: "Hair Treatments", mins: 45, price: 55, deposit: 20, from: false },
];

export const STYLISTS = [
  "Any available stylist",
  "Senior stylist",
  "Colour specialist",
  "Protective styling",
];

export const TIMES = [
  "09:00",
  "10:00",
  "11:30",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "18:30",
];

export const DEFAULT_SERVICE_ID = "silk";

export function getService(id: string): Service {
  return SERVICES.find((s) => s.id === id) ?? SERVICES[0];
}

/** "£85" / "from £150" */
export function formatPrice(service: Service): string {
  return `${service.from ? "from £" : "£"}${service.price}`;
}

/** The next `count` days, starting today, at local midnight. */
export function upcomingDates(count = 10, base: Date = new Date()): Date[] {
  return Array.from(
    { length: count },
    (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i),
  );
}

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const formatDayMonth = (d: Date) => dayMonth.format(d);
export const formatWeekday = (d: Date) => weekday.format(d);
export const formatFullDate = (d: Date) => fullDate.format(d);

/** Deterministic placeholder reference, matching the design's scheme. */
export function bookingReference(dateIdx: number, time: string): string {
  return `PHS-${1000 + dateIdx * 7 + TIMES.indexOf(time)}`;
}
