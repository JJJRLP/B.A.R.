import type { PaymentMethod, Sale } from "./types";
import { METHOD_LABEL } from "./types";
import { businessDay } from "./format";

export type ActivityKind = "sale" | "verified" | "rejected" | "void";

export interface ActivityEvent {
  id: string;
  at: string; // ISO timestamp of the action
  kind: ActivityKind;
  actorId: string | null;
  actorName: string;
  amount: number;
  method?: PaymentMethod;
  detail: string;
  sale: Sale;
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  sale: "Registró venta",
  verified: "Verificó pago",
  rejected: "Rechazó pago",
  void: "Anuló venta",
};

const items = (s: Sale) => s.items.map((i) => `${i.qty}× ${i.name}`).join(", ");

/** Turns sales into a flat, newest-first log of who did what and when. */
export function buildActivity(sales: Sale[], from: string, to: string, actorId?: string): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const s of sales) {
    const pay = s.payments[0];
    out.push({
      id: `${s.id}:sale`,
      at: s.created_at,
      kind: "sale",
      actorId: s.created_by,
      actorName: s.created_by_name ?? "—",
      amount: s.total,
      method: pay?.method,
      detail: [items(s), pay ? METHOD_LABEL[pay.method] : "", s.table_label ? `Mesa ${s.table_label}` : ""].filter(Boolean).join(" · "),
      sale: s,
    });
    for (const p of s.payments) {
      // cash/card are verified automatically on entry by the same person; only log manual checks
      if (p.method !== "qr" || !p.verified_at || p.status === "pending") continue;
      out.push({
        id: `${p.id}:${p.status}`,
        at: p.verified_at,
        kind: p.status === "verified" ? "verified" : "rejected",
        actorId: p.verified_by,
        actorName: p.verified_by_name ?? "—",
        amount: p.amount,
        method: p.method,
        detail: `Venta de ${s.created_by_name ?? "—"}${p.reference ? ` · Ref. ${p.reference}` : ""}${p.status === "rejected" && p.reject_reason ? ` · Motivo: ${p.reject_reason}` : ""}`,
        sale: s,
      });
    }
    if (s.status === "void" && s.voided_at) {
      out.push({
        id: `${s.id}:void`,
        at: s.voided_at,
        kind: "void",
        actorId: s.voided_by,
        actorName: s.voided_by_name ?? "—",
        amount: s.total,
        detail: `Venta de ${s.created_by_name ?? "—"}${s.void_reason ? ` · Motivo: ${s.void_reason}` : ""}`,
        sale: s,
      });
    }
  }
  return out
    .filter((e) => {
      const d = businessDay(e.at);
      return d >= from && d <= to && (!actorId || e.actorId === actorId);
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}
