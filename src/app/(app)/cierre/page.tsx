"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getApi } from "@/lib/data";
import { addDays, bs, businessDay, longDay } from "@/lib/format";
import { exportProductsCsv, exportSalesCsv } from "@/lib/csv";
import type { PaymentMethod, Sale } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/types";
import { Button, Card, Input, Label, PageHeader, Spinner, cx } from "@/components/ui";

const METHODS: PaymentMethod[] = ["qr", "cash", "card"];

export default function ClosePage() {
  const today = businessDay();
  const [day, setDay] = useState(today);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [cashCount, setCashCount] = useState("");

  const load = useCallback(async () => {
    setSales(null);
    setSales(await getApi().listSales({ from: day, to: day }));
  }, [day]);

  useEffect(() => {
    load().catch(() => setSales([]));
  }, [load]);

  const s = useMemo(() => {
    const list = sales ?? [];
    const active = list.filter((x) => x.status !== "void");
    const payments = active.flatMap((x) => x.payments);
    const byMethod = Object.fromEntries(
      METHODS.map((m) => {
        const ps = payments.filter((p) => p.method === m);
        return [m, { verified: ps.filter((p) => p.status === "verified").reduce((a, p) => a + p.amount, 0), pending: ps.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0), count: ps.length }];
      }),
    ) as Record<PaymentMethod, { verified: number; pending: number; count: number }>;
    const products = new Map<string, { name: string; qty: number; amount: number }>();
    for (const sale of active)
      for (const i of sale.items) {
        const row = products.get(i.product_id) ?? { name: i.name, qty: 0, amount: 0 };
        row.qty += i.qty;
        row.amount += i.subtotal;
        products.set(i.product_id, row);
      }
    const pending = payments.filter((p) => p.status === "pending");
    const rejected = payments.filter((p) => p.status === "rejected");
    return {
      count: active.length,
      sold: active.reduce((a, x) => a + x.total, 0),
      verified: payments.filter((p) => p.status === "verified").reduce((a, p) => a + p.amount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((a, p) => a + p.amount, 0),
      rejectedCount: rejected.length,
      rejectedAmount: rejected.reduce((a, p) => a + p.amount, 0),
      voided: list.length - active.length,
      byMethod,
      products: Array.from(products.values()).sort((a, b) => b.amount - a.amount),
    };
  }, [sales]);

  const cashDiff = cashCount === "" ? null : Number(cashCount) - s.byMethod.cash.verified;

  return (
    <div>
      <PageHeader
        title="Cierre del día"
        subtitle={<span className="inline-block first-letter:uppercase">{longDay(day)}</span>}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setDay(addDays(day, -1))} aria-label="Día anterior">
              <ChevronLeft size={16} />
            </Button>
            <div className="w-40">
              <Input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-8" />
            </div>
            <Button size="sm" variant="secondary" disabled={day >= today} onClick={() => setDay(addDays(day, 1))} aria-label="Día siguiente">
              <ChevronRight size={16} />
            </Button>
          </>
        }
      />

      {!sales ? (
        <div className="py-14 grid place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {s.pendingCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3">
              <p className="text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="text-accent" />
                {s.pendingCount} {s.pendingCount === 1 ? "pago pendiente" : "pagos pendientes"} por {bs(s.pendingAmount)}. El cierre no está completo.
              </p>
              <Link href="/pendientes" className="text-sm text-accent hover:underline">
                Revisar pendientes →
              </Link>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Vendido" value={bs(s.sold)} hint={`${s.count} ${s.count === 1 ? "venta" : "ventas"}`} />
            <Kpi label="Cobrado verificado" value={bs(s.verified)} tone="ok" />
            <Kpi label="Pendiente" value={bs(s.pendingAmount)} hint={`${s.pendingCount} pagos`} tone={s.pendingCount ? "accent" : undefined} />
            <Kpi label="Rechazado / anulado" value={bs(s.rejectedAmount)} hint={`${s.rejectedCount} rechazados · ${s.voided} anuladas`} tone={s.rejectedCount ? "bad" : undefined} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            {/* By method */}
            <Card className="p-5">
              <h2 className="font-semibold mb-4">Por método de pago</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="text-left font-medium pb-2">Método</th>
                    <th className="text-right font-medium pb-2">Pagos</th>
                    <th className="text-right font-medium pb-2">Verificado</th>
                    <th className="text-right font-medium pb-2">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {METHODS.map((m) => (
                    <tr key={m}>
                      <td className="py-2.5">{METHOD_LABEL[m]}</td>
                      <td className="py-2.5 text-right tabular text-ink-2">{s.byMethod[m].count}</td>
                      <td className="py-2.5 text-right tabular">{bs(s.byMethod[m].verified)}</td>
                      <td className={cx("py-2.5 text-right tabular", s.byMethod[m].pending ? "text-accent" : "text-muted")}>{bs(s.byMethod[m].pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-5 border-t border-line">
                <h3 className="text-sm font-semibold mb-3">Arqueo de efectivo</h3>
                <div className="flex items-end gap-3">
                  <label className="flex-1">
                    <Label>Efectivo contado en caja</Label>
                    <Input type="number" inputMode="decimal" step="0.01" value={cashCount} onChange={(e) => setCashCount(e.target.value)} placeholder={s.byMethod.cash.verified.toFixed(2)} className="tabular" />
                  </label>
                  <div className="text-right pb-2 min-w-28">
                    <p className="text-xs text-muted">Diferencia</p>
                    <p className={cx("font-semibold tabular", cashDiff === null ? "text-muted" : Math.abs(cashDiff) < 0.01 ? "text-ok" : "text-bad")}>
                      {cashDiff === null ? "—" : `${cashDiff > 0 ? "+" : ""}${bs(cashDiff)}`}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted mt-2">Esperado según el sistema: {bs(s.byMethod.cash.verified)}</p>
              </div>
            </Card>

            {/* By product */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Por producto</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={!s.products.length} onClick={() => exportProductsCsv(s.products, day)}>
                    <Download size={14} /> Productos
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!sales.length} onClick={() => exportSalesCsv(sales, day)}>
                    <Download size={14} /> Ventas
                  </Button>
                </div>
              </div>
              {s.products.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">Sin ventas este día.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted">
                      <th className="text-left font-medium pb-2">Producto</th>
                      <th className="text-right font-medium pb-2">Cant.</th>
                      <th className="text-right font-medium pb-2">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.products.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2.5">{p.name}</td>
                        <td className="py-2.5 text-right tabular text-ink-2">{p.qty}</td>
                        <td className="py-2.5 text-right tabular">{bs(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line font-medium">
                      <td className="pt-3">Total</td>
                      <td className="pt-3 text-right tabular">{s.products.reduce((a, p) => a + p.qty, 0)}</td>
                      <td className="pt-3 text-right tabular">{bs(s.sold)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "accent" | "bad" }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("text-xl md:text-2xl font-semibold tabular mt-1", tone === "ok" && "text-ok", tone === "accent" && "text-accent", tone === "bad" && "text-bad")}>{value}</p>
      {hint && <p className="text-xs text-ink-2 mt-0.5">{hint}</p>}
    </Card>
  );
}
