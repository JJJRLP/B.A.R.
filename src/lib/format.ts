const money = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const bs = (n: number) => `Bs ${money.format(n || 0)}`;

const TZ = "America/La_Paz";
const ROLLOVER_HOURS = 6;

/** Business day (yyyy-mm-dd) for a timestamp: La Paz time minus 6 h, so after-midnight sales count for the night before. */
export function businessDay(d: Date | string = new Date()): string {
  const t = new Date(typeof d === "string" ? d : d.getTime());
  const shifted = new Date(t.getTime() - ROLLOVER_HOURS * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}

export const time = (iso: string) =>
  new Intl.DateTimeFormat("es-BO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-BO", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const longDay = (day: string) =>
  new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(day + "T00:00:00Z"));

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
