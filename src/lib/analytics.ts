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
