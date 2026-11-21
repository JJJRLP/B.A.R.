import type { Sale } from "./types";
import { METHOD_LABEL, STATUS_LABEL } from "./types";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(name: string, rows: unknown[][]) {
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSalesCsv(sales: Sale[], label: string) {
  const rows: unknown[][] = [
    [
      "dia", "noche_evento", "preventa", "relacionador", "fecha_hora", "venta_id", "registrado_por", "titular", "ci_titular", "acompanantes", "personas", "mesa", "productos", "total_venta",
      "metodo", "monto_pagado", "estado_pago", "referencia", "verificado_por", "verificado_en", "motivo_rechazo",
      "estado_venta", "anulado_por", "anulado_en", "motivo_anulacion", "nota",
    ],
  ];
  for (const s of sales)
    for (const p of s.payments)
      rows.push([
        s.business_day,
        s.event_day ?? s.business_day,
        s.is_presale ? "si" : "no",
        s.promoter_code ?? "",
        s.created_at,
        s.id,
        s.created_by_name ?? "",
        s.customer_name ?? "",
        s.customer_ci ?? "",
        (s.guests ?? []).map((g) => (g.ci ? `${g.full_name} (CI ${g.ci})` : g.full_name)).join(" | "),
        s.items.filter((i) => i.product_type === "entrada").reduce((a, i) => a + i.qty * (i.people_per_unit ?? 1), 0),
        s.table_label ?? "",
        s.items.map((i) => `${i.qty}x ${i.name}${i.unit_cost != null ? ` (costo ${i.unit_cost.toFixed(2)})` : ""}`).join(" | "),
        s.total.toFixed(2),
        METHOD_LABEL[p.method],
        p.amount.toFixed(2),
        STATUS_LABEL[p.status],
        p.reference ?? "",
        p.verified_by_name ?? "",
        p.verified_at ?? "",
        p.reject_reason ?? "",
        s.status === "void" ? "anulada" : "vigente",
        s.voided_by_name ?? "",
        s.voided_at ?? "",
        s.void_reason ?? "",
        s.note ?? "",
      ]);
  downloadCsv(`ventas_${label}.csv`, rows);
}

export function exportProductsCsv(rows: { name: string; type?: string; qty: number; amount: number }[], label: string) {
  downloadCsv(`productos_${label}.csv`, [
    ["tipo", "producto", "cantidad", "monto_bs"],
    ...rows.map((r) => [r.type === "entrada" ? "entrada" : "barra", r.name, r.qty, r.amount.toFixed(2)]),
  ]);
}
