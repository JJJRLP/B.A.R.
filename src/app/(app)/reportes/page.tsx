"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApi } from "@/lib/data";
import { addDays, bs, businessDay } from "@/lib/format";
import type { Product, Sale } from "@/lib/types";
import { costSummary, peopleByNight, planRows, presaleSold, promoterRows, topProducts } from "@/lib/analytics";
import { CostCard, PlansTable, PromotersTable, TopProducts } from "@/components/Analytics";
import { Card, Input, Label, PageHeader, Spinner, cx } from "@/components/ui";

const RANGES = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

export default function ReportsPage() {
  const today = businessDay();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [sold, setSold] = useState<Sale[] | null>(null); // sold in the range
  const [nights, setNights] = useState<Sale[]>([]); // entries for nights in the range (presales included)
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    setSold(null);
    const api = getApi();
    const [a, b, p] = await Promise.all([
      api.listSales({ from, to }),
      api.listSales({ from, to, by: "event_day" }),
      api.listProducts(true),
    ]);
    setNights(b);
    setProducts(p);
    setSold(a);
  }, [from, to]);
  useEffect(() => {
    load().catch(() => setSold([]));
  }, [load]);

  const r = useMemo(() => {
    const list = sold ?? [];
    const activeSold = list.filter((s) => s.status !== "void");
    const plans = planRows(nights, products).map((p) => ({ ...p, limit: null }));
    return {
      revenue: activeSold.reduce((a, s) => a + s.total, 0),
      salesCount: activeSold.length,
      people: plans.reduce((a, p) => a + p.people, 0),
      plans,
      grid: peopleByNight(nights),
      top: topProducts(list),
      promoters: promoterRows(list),
      costs: costSummary(list),
      presale: presaleSold(list),
    };
  }, [sold, nights, products]);

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Personas por plan, productos más vendidos, relacionadores y márgenes en un período." />

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label>
          <Label>Desde</Label>
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label>
          <Label>Hasta</Label>
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <div className="flex gap-1">
          {RANGES.map((x) => {
            const f = addDays(today, -(x.days - 1));
            return (
              <button
                key={x.days}
                onClick={() => {
                  setFrom(f);
                  setTo(today);
                }}
                className={cx(
                  "h-10 px-3 rounded-lg border text-sm",
                  from === f && to === today ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-2 hover:text-ink",
                )}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      {!sold ? (
        <div className="py-14 grid place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Vendido" value={bs(r.revenue)} hint={`${r.salesCount} ${r.salesCount === 1 ? "venta" : "ventas"}`} />
            <Kpi label="Personas" value={String(r.people)} hint="por noche del evento" />
            <Kpi label="Preventas vendidas" value={bs(r.presale.soldAmount)} hint={`${r.presale.soldCount} ventas · ${r.presale.soldPeople} personas`} />
            <Kpi label="Margen" value={bs(r.costs.margin)} hint="sobre productos con costo" />
          </div>

          {/* People per night per plan */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Personas por noche y plan</h2>
            {r.grid.days.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">Sin entradas en el período.</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm" style={{ minWidth: 200 + r.grid.plans.length * 120 }}>
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted">
                      <th className="text-left font-medium pb-2">Noche</th>
                      {r.grid.plans.map((p) => (
                        <th key={p.id} className="text-right font-medium pb-2">
                          {p.name}
                        </th>
                      ))}
                      <th className="text-right font-medium pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.grid.days.map((d) => {
                      const row = r.grid.cells[d] ?? {};
                      const total = Object.values(row).reduce((a, n) => a + n, 0);
                      return (
                        <tr key={d}>
                          <td className="py-2.5 tabular whitespace-nowrap">{d}</td>
                          {r.grid.plans.map((p) => (
                            <td key={p.id} className={cx("py-2.5 text-right tabular", row[p.id] ? "" : "text-muted")}>
                              {row[p.id] ?? "—"}
                            </td>
                          ))}
                          <td className="py-2.5 text-right tabular font-semibold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <PlansTable rows={r.plans} title="Planes más vendidos" />
          <div className="grid gap-5 lg:grid-cols-2">
            <TopProducts rows={r.top} limit={10} />
            <PromotersTable rows={r.promoters} />
          </div>
          <CostCard summary={r.costs} products={r.top} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="text-xl md:text-2xl font-semibold tabular mt-1">{value}</p>
      {hint && <p className="text-xs text-ink-2 mt-0.5">{hint}</p>}
    </Card>
  );
}
