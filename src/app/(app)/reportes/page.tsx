"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApi } from "@/lib/data";
import { addDays, bs, businessDay, longDay, shortDay } from "@/lib/format";
import type { Product, Sale } from "@/lib/types";
import { costSummary, methodTotals, peopleTotals, planRows, presaleSold, promoterRows, revenueByNight, salesByHour, topProducts } from "@/lib/analytics";
import { CostCard, PlansTable, PromotersTable, TopProducts } from "@/components/Analytics";
import { ColumnChart, SegmentedBar, type Column } from "@/components/Charts";
import { Card, Input, Label, PageHeader, Spinner, cx } from "@/components/primitives";

const RANGES = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

// chart series colours are validated chart tokens (globals.css --chart-*)
const SERIES_NIGHT = [
  { id: "door", name: "Puerta", color: "var(--chart-door)" },
  { id: "bar", name: "Barra", color: "var(--chart-bar)" },
];
const SERIES_PEOPLE = [{ id: "people", name: "Personas", color: "var(--chart-door)" }];
const SERIES_HOUR = [{ id: "sales", name: "Ventas", color: "var(--chart-dim)" }];

const peopleFmt = (n: number) => `${n}`;
const salesN = (n: number) => `${n} ${n === 1 ? "venta" : "ventas"}`;
const hh = (h: number) => String(h).padStart(2, "0");
/** Axis label for a night: weekday initial for a week, dd/mm for longer ranges. */
const axisDay = (day: string, long: boolean) => (long ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : shortDay(day).split(" ")[0].replace(/[.,]/g, ""));

export default function ReportsPage() {
  const today = businessDay();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [sold, setSold] = useState<Sale[] | null>(null); // sold in the range
  const [nights, setNights] = useState<Sale[]>([]); // entries for nights in the range (presales included)
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const api = getApi();
    const [a, b, p] = await Promise.all([
      api.listSales({ from, to }),
      api.listSales({ from, to, by: "event_day" }),
      api.listProducts(true),
    ]);
    setNights(b);
    setProducts(p);
    setSold(a);
    setLoading(false);
  }, [from, to]);
  useEffect(() => {
    load().catch(() => {
      setSold([]);
      setLoading(false);
    });
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
      top: topProducts(list),
      promoters: promoterRows(list),
      costs: costSummary(list),
      presale: presaleSold(list),
      byNight: revenueByNight(list, from, to),
      peopleNight: peopleTotals(nights, from, to),
      hours: salesByHour(list),
      methods: methodTotals(list),
    };
  }, [sold, nights, products, from, to]);

  const long = r.byNight.length > 10;
  const nightCols: Column[] = r.byNight.map((n) => ({
    key: n.day,
    label: axisDay(n.day, long),
    title: longDay(n.day),
    values: { door: n.door, bar: n.bar },
  }));
  const peopleCols: Column[] = r.peopleNight.map((n) => ({
    key: n.day,
    label: axisDay(n.day, long),
    title: longDay(n.day),
    values: { people: n.total },
    extra: n.plans.map((p) => ({ name: p.name, value: String(p.people) })),
  }));
  // emphasis: the busiest hour in off-white, the rest recede
  const peakHour = r.hours.reduce<(typeof r.hours)[number] | undefined>((best, h) => (h.sales > (best?.sales ?? 0) ? h : best), undefined);
  const hourCols: Column[] = r.hours.map((h) => ({
    key: hh(h.hour),
    label: hh(h.hour),
    title: `${hh(h.hour)}:00 – ${hh(h.hour)}:59`,
    values: { sales: h.sales },
    color: h === peakHour ? "var(--chart-peak)" : undefined,
    extra: [{ name: "cobrado", value: bs(h.amount) }],
  }));

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Ingresos, personas, horas pico, pagos, planes, productos y relacionadores en un período." />

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
                  from === f && to === today ? "border-foreground bg-foreground text-background" : "border-line text-ink-2 hover:text-ink",
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
        // a refetch keeps the frame: the previous numbers dim instead of vanishing
        <div className={cx("space-y-5 transition-opacity duration-150", loading && "opacity-50")} aria-busy={loading}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Vendido" value={bs(r.revenue)} hint={salesN(r.salesCount)} />
            <Kpi label="Personas" value={String(r.people)} hint="por noche del evento" />
            <Kpi label="Preventas vendidas" value={bs(r.presale.soldAmount)} hint={`${r.presale.soldCount} ventas · ${r.presale.soldPeople} personas`} />
            <Kpi label="Margen" value={bs(r.costs.margin)} hint="sobre productos con costo" />
          </div>

          <ChartCard title="Ingresos por noche" note="Lo cobrado cada noche, en puerta y en barra.">
            <ColumnChart columns={nightCols} series={SERIES_NIGHT} format={bs} ariaLabel="Ingresos por noche, puerta y barra" tableHead="Noche" />
          </ChartCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Personas por noche" note="Entradas incluidas en cada plan, por noche del evento.">
              <ColumnChart columns={peopleCols} series={SERIES_PEOPLE} format={peopleFmt} height={180} ariaLabel="Personas por noche" tableHead="Noche" />
            </ChartCard>
            <ChartCard title="Hora pico" note={peakHour ? `La hora con más ventas: ${hh(peakHour.hour)}:00 (${salesN(peakHour.sales)}).` : "Ventas por hora de la noche."}>
              <ColumnChart
                columns={hourCols}
                series={SERIES_HOUR}
                format={salesN}
                height={180}
                labelEvery={hourCols.length > 12 ? 2 : 1}
                ariaLabel="Ventas por hora"
                tableHead="Hora"
              />
            </ChartCard>
          </div>

          <ChartCard title="Métodos de pago" note="Cómo se cobró lo vendido en el período.">
            <SegmentedBar
              ariaLabel="Reparto por método de pago"
              format={bs}
              parts={[
                { id: "qr", name: "QR / Transferencia", value: r.methods.qr, color: "var(--chart-qr)" },
                { id: "cash", name: "Efectivo", value: r.methods.cash, color: "var(--chart-cash)" },
                { id: "card", name: "Tarjeta", value: r.methods.card, color: "var(--chart-card)" },
              ]}
            />
          </ChartCard>

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

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="text-sm text-ink-2 mt-0.5 mb-4">{note}</p>}
      {children}
    </Card>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="text-xl md:text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-ink-2 mt-0.5">{hint}</p>}
    </Card>
  );
}
