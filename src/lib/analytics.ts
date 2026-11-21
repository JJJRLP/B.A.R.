import type { Product, Sale } from "./types";

const active = (sales: Sale[]) => sales.filter((s) => s.status !== "void");
const nightOf = (s: Sale) => s.event_day ?? s.business_day;

export interface PlanRow {
  product_id: string;
  name: string;
  units: number; // entries / tables sold
  people: number; // units × entradas incluidas
  presaleUnits: number;
  amount: number;
  limit: number | null; // per-night limit, if set
}

/** Entry plans for the given sales (use sales whose entries are for the night/range). */
export function planRows(sales: Sale[], products: Product[] = []): PlanRow[] {
  const map = new Map<string, PlanRow>();
  for (const s of active(sales))
    for (const i of s.items) {
      if (i.product_type !== "entrada") continue;
      const row = map.get(i.product_id) ?? {
        product_id: i.product_id,
        name: i.name,
        units: 0,
        people: 0,
        presaleUnits: 0,
        amount: 0,
        limit: products.find((p) => p.id === i.product_id)?.max_per_night ?? null,
      };
      row.units += i.qty;
      row.people += i.qty * (i.people_per_unit ?? 1);
      if (s.is_presale) row.presaleUnits += i.qty;
      row.amount += i.subtotal;
      map.set(i.product_id, row);
    }
  return Array.from(map.values()).sort((a, b) => b.people - a.people || b.units - a.units);
}

export interface ProductRow {
  product_id: string;
  name: string;
  qty: number;
  amount: number;
  cost: number | null; // null when no unit cost was recorded
  margin: number | null;
}

/** Bar products ranked by quantity sold. */
export function topProducts(sales: Sale[]): ProductRow[] {
  const map = new Map<string, ProductRow & { costKnown: boolean }>();
  for (const s of active(sales))
    for (const i of s.items) {
      if (i.product_type !== "consumo") continue;
      const row = map.get(i.product_id) ?? { product_id: i.product_id, name: i.name, qty: 0, amount: 0, cost: 0, margin: 0, costKnown: true };
      row.qty += i.qty;
      row.amount += i.subtotal;
      if (i.unit_cost == null) row.costKnown = false;
      else row.cost = (row.cost ?? 0) + i.unit_cost * i.qty;
      map.set(i.product_id, row);
    }
  return Array.from(map.values())
    .map(({ costKnown, ...r }) => ({ ...r, cost: costKnown ? r.cost : null, margin: costKnown ? r.amount - (r.cost ?? 0) : null }))
    .sort((a, b) => b.qty - a.qty || b.amount - a.amount);
}

export interface PromoterRow {
  code: string;
  sales: number;
  people: number;
  amount: number; // entries amount
}

/** Entry sales grouped by código de relacionador (sales without a code are left out). */
export function promoterRows(sales: Sale[]): PromoterRow[] {
  const map = new Map<string, PromoterRow>();
  for (const s of active(sales)) {
    if (!s.promoter_code) continue;
    const entries = s.items.filter((i) => i.product_type === "entrada");
    if (!entries.length) continue;
    const row = map.get(s.promoter_code) ?? { code: s.promoter_code, sales: 0, people: 0, amount: 0 };
    row.sales += 1;
    row.people += entries.reduce((a, i) => a + i.qty * (i.people_per_unit ?? 1), 0);
    row.amount += entries.reduce((a, i) => a + i.subtotal, 0);
    map.set(s.promoter_code, row);
  }
  return Array.from(map.values()).sort((a, b) => b.people - a.people || b.amount - a.amount);
}

export interface CostSummary {
  revenue: number; // all items sold
  costedRevenue: number; // items that have a unit cost
  cost: number;
  margin: number; // costedRevenue − cost
  uncostedItems: number; // sold lines without a cost
}

export function costSummary(sales: Sale[]): CostSummary {
  const out: CostSummary = { revenue: 0, costedRevenue: 0, cost: 0, margin: 0, uncostedItems: 0 };
  for (const s of active(sales))
    for (const i of s.items) {
      out.revenue += i.subtotal;
      if (i.unit_cost == null) {
        if (i.subtotal > 0) out.uncostedItems += 1;
        continue;
      }
      out.costedRevenue += i.subtotal;
      out.cost += i.unit_cost * i.qty;
    }
  out.margin = out.costedRevenue - out.cost;
  return out;
}

export interface PresaleSummary {
  soldCount: number; // presales sold in these sales
  soldAmount: number;
  soldPeople: number;
}

/** Presales sold in the given sales (sold on these days, for any future night). */
export function presaleSold(sales: Sale[]): PresaleSummary {
  const out = { soldCount: 0, soldAmount: 0, soldPeople: 0 };
  for (const s of active(sales)) {
    if (!s.is_presale) continue;
    out.soldCount += 1;
    out.soldAmount += s.total;
    out.soldPeople += s.items.reduce((a, i) => a + (i.product_type === "entrada" ? i.qty * (i.people_per_unit ?? 1) : 0), 0);
  }
  return out;
}

/** People per night per plan: { days: [...], plans: [...], cells: day → product id → people }. */
export function peopleByNight(sales: Sale[]) {
  const days = new Set<string>();
  const plans = new Map<string, string>();
  const cells: Record<string, Record<string, number>> = {};
  for (const s of active(sales))
    for (const i of s.items) {
      if (i.product_type !== "entrada") continue;
      const d = nightOf(s);
      days.add(d);
      plans.set(i.product_id, i.name);
      cells[d] ??= {};
      cells[d][i.product_id] = (cells[d][i.product_id] ?? 0) + i.qty * (i.people_per_unit ?? 1);
    }
  return {
    days: Array.from(days).sort().reverse(),
    plans: Array.from(plans, ([id, name]) => ({ id, name })),
    cells,
  };
}

/** Every business day from `from` to `to`, inclusive (yyyy-mm-dd). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface NightRevenue {
  day: string;
  door: number; // entries (puerta)
  bar: number; // consumo (barra)
}

/** Money taken per business day in the range, split door / bar (voided sales left out). */
export function revenueByNight(sales: Sale[], from: string, to: string): NightRevenue[] {
  const rows = new Map(daysBetween(from, to).map((day) => [day, { day, door: 0, bar: 0 }]));
  for (const s of active(sales)) {
    const row = rows.get(s.business_day);
    if (!row) continue;
    for (const i of s.items) {
      if (i.product_type === "entrada") row.door += i.subtotal;
      else row.bar += i.subtotal;
    }
  }
  return Array.from(rows.values());
}

/** People per night in the range (zero-filled), with the per-plan split for tooltips. */
export function peopleTotals(sales: Sale[], from: string, to: string) {
  const grid = peopleByNight(sales);
  return daysBetween(from, to).map((day) => {
    const cells = grid.cells[day] ?? {};
    return {
      day,
      total: Object.values(cells).reduce((a, n) => a + n, 0),
      plans: grid.plans.filter((p) => cells[p.id]).map((p) => ({ name: p.name, people: cells[p.id] })),
    };
  });
}

const hourOf = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/La_Paz", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

export interface HourRow {
  hour: number; // 0-23, La Paz
  sales: number;
  amount: number;
}

/** Sales per clock hour, in night order (06:00 → 05:00), trimmed to the hours that had sales. */
export function salesByHour(sales: Sale[]): HourRow[] {
  const order = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);
  const rows = new Map(order.map((hour) => [hour, { hour, sales: 0, amount: 0 }]));
  for (const s of active(sales)) {
    const r = rows.get(hourOf(s.created_at))!;
    r.sales += 1;
    r.amount += s.total;
  }
  const list = order.map((h) => rows.get(h)!);
  const first = list.findIndex((r) => r.sales > 0);
  if (first < 0) return [];
  let last = list.length - 1;
  while (list[last].sales === 0) last--;
  return list.slice(first, last + 1);
}

/** Money received per payment method (voided sales left out). */
export function methodTotals(sales: Sale[]) {
  const out = { qr: 0, cash: 0, card: 0 } as Record<"qr" | "cash" | "card", number>;
  for (const s of active(sales)) for (const p of s.payments) out[p.method] += p.amount;
  return out;
}
