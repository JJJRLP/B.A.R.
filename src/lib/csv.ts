import type { Sale } from "./types";
import { METHOD_LABEL, STATUS_LABEL } from "./types";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(name: string, rows: unknown[][]) {
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
    ["dia", "fecha_hora", "venta_id", "personal", "mesa", "estado_venta", "metodo", "monto", "estado_pago", "referencia", "total_venta", "productos", "nota"],
  ];
  for (const s of sales)
    for (const p of s.payments)
      rows.push([
        s.business_day,
        s.created_at,
        s.id,
        s.created_by_name ?? "",
        s.table_label ?? "",
        s.status === "void" ? "anulada" : "pagada",
        METHOD_LABEL[p.method],
        p.amount.toFixed(2),
        STATUS_LABEL[p.status],
        p.reference ?? "",
        s.total.toFixed(2),
        s.items.map((i) => `${i.qty}x ${i.name}`).join(" | "),
        s.note ?? "",
      ]);
  download(`ventas_${label}.csv`, rows);
}

export function exportProductsCsv(rows: { name: string; qty: number; amount: number }[], label: string) {
  download(`productos_${label}.csv`, [["producto", "cantidad", "monto_bs"], ...rows.map((r) => [r.name, r.qty, r.amount.toFixed(2)])]);
}
