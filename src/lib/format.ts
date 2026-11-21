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

/** Seconds since the 06:00 rollover, wrapped to 0..86399 (so 01:00 is late night). */
function secondsIntoNight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (((h * 3600 + (m || 0) * 60 - ROLLOVER_HOURS * 3600) % 86400) + 86400) % 86400;
}

function laPazHHMM(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** Same rule as the database's effective_price(): entries are free before free_until. */
export function isFreeNow(freeUntil: string | null | undefined, now = new Date()): boolean {
  if (!freeUntil) return false;
  return secondsIntoNight(laPazHHMM(now)) < secondsIntoNight(freeUntil.slice(0, 5));
}

export function effectivePrice(p: { type: string; price: number; free_until?: string | null }, now = new Date()): number {
  return p.type === "entrada" && isFreeNow(p.free_until, now) ? 0 : p.price;
}

/** True if a sale's buyer, CI or any guest matches the search text. */
export function matchesPerson(
  s: { customer_name?: string | null; customer_ci?: string | null; guests?: { full_name: string; ci?: string | null }[] },
  q: string,
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const has = (v?: string | null) => !!v && v.toLowerCase().includes(t);
  return has(s.customer_name) || has(s.customer_ci) || (s.guests ?? []).some((g) => has(g.full_name) || has(g.ci));
}
