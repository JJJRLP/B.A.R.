"use client";

import { useId, useMemo, useState } from "react";
import { cx } from "./primitives";

/*
  Nox chart kit (see DESIGN.md "Charts"). Hand-built in HTML so it shares the app's
  type and tokens:
  - columns ≤ 24px, 4px rounded data-end, square at the baseline, 2px surface gap
    between stacked segments
  - hairline solid gridlines, clean ticks, mono figures
  - every column is a focusable hit target with a tooltip (values lead, names follow)
  - a legend for 2+ series, a "Ver tabla" view so nothing depends on hovering
  Series colours are validated chart tokens (--chart-*), never the app's action yellow.
*/

export interface Series {
  id: string;
  name: string;
  color: string; // a CSS colour, normally var(--chart-*)
}

export interface Column {
  key: string;
  label: string; // short axis label
  title: string; // tooltip / table heading
  values: Record<string, number>; // series id → value
  color?: string; // per-column override (emphasis charts)
  extra?: { name: string; value: string }[]; // more tooltip rows
}

const niceStep = (max: number, ticks = 4) => {
  const raw = Math.max(max, 1) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
};

const tickFmt = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });
const compact = (n: number) => (n >= 10000 ? `${tickFmt.format(Math.round(n / 1000))}K` : tickFmt.format(n));

export function ColumnChart({
  columns,
  series,
  format,
  height = 200,
  labelEvery,
  ariaLabel,
  tableHead = "Fecha",
}: {
  columns: Column[];
  series: Series[];
  format: (n: number) => string;
  height?: number;
  labelEvery?: number;
  ariaLabel: string;
  tableHead?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const tableId = useId();

  const totals = columns.map((c) => series.reduce((a, s) => a + (c.values[s.id] ?? 0), 0));
  const maxTotal = Math.max(0, ...totals);
  const step = niceStep(maxTotal);
  const top = Math.max(step, Math.ceil(maxTotal / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const peak = totals.indexOf(maxTotal);
  const every = labelEvery ?? Math.max(1, Math.ceil(columns.length / 8));
  const empty = maxTotal === 0;

  const tip = active != null ? columns[active] : null;
  const tipLeft = active != null ? ((active + 0.5) / columns.length) * 100 : 0;

  return (
    <div>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-sm text-ink-2" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {table ? (
        <ChartTable id={tableId} columns={columns} series={series} format={format} head={tableHead} />
      ) : (
        <div className="flex gap-2" role="group" aria-label={ariaLabel}>
          {/* y axis */}
          <div className="relative shrink-0 w-11 font-mono text-[11px] text-muted-foreground tabular" style={{ height }} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 leading-none" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
                {compact(t)}
              </span>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            {/* plot */}
            <div className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
              {ticks.map((t) => (
                <div key={t} aria-hidden className={cx("absolute inset-x-0 h-px", t === 0 ? "bg-muted-foreground/50" : "bg-line/70")} style={{ bottom: `${(t / top) * 100}%` }} />
              ))}

              <div className="absolute inset-0 flex items-end">
                {columns.map((c, i) => {
                  const total = totals[i];
                  const parts = series.filter((s) => (c.values[s.id] ?? 0) > 0);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      aria-label={`${c.title}: ${series.map((s) => `${s.name} ${format(c.values[s.id] ?? 0)}`).join(", ")}`}
                      className="group relative h-full flex-1 min-w-0 flex flex-col justify-end items-center outline-none"
                    >
                      {/* hover band: the whole slot is the hit target */}
                      <span aria-hidden className={cx("absolute inset-x-0 inset-y-0 rounded-md transition-colors duration-100", active === i ? "bg-foreground/[0.05]" : "")} />
                      <span
                        aria-hidden
                        className="relative flex flex-col-reverse w-[min(24px,62%)] gap-[2px] transition-[filter] duration-100 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary rounded-t-[4px]"
                        style={{ height: `${(total / top) * 100}%`, filter: active === i ? "brightness(1.15)" : undefined }}
                      >
                        {parts.map((s, j) => (
                          <span
                            key={s.id}
                            className={cx("block w-full min-h-[2px]", j === parts.length - 1 && "rounded-t-[4px]")}
                            style={{ flexGrow: c.values[s.id], flexBasis: 0, background: c.color ?? s.color }}
                          />
                        ))}
                      </span>
                      {/* the one direct label: the peak */}
                      {i === peak && !empty && active == null && (
                        <span
                          aria-hidden
                          className="absolute left-1/2 -translate-x-1/2 font-mono text-[11px] font-semibold text-ink tabular whitespace-nowrap"
                          style={{ bottom: `calc(${(total / top) * 100}% + 6px)` }}
                        >
                          {format(total)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {empty && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sin datos en el período.</p>}

              {/* tooltip */}
              {tip && (
                <div
                  role="status"
                  className="pointer-events-none absolute z-10 bottom-full mb-2 w-max min-w-44 max-w-64 rounded-lg border border-line bg-popover px-3 py-2 shadow-[0_8px_24px_rgb(11_8_23/0.5)]"
                  style={{ left: `clamp(0px, calc(${tipLeft}% - 88px), calc(100% - 176px))` }}
                >
                  <p className="text-xs text-ink-2 first-letter:uppercase mb-1">{tip.title}</p>
                  {series.length > 1 && <p className="font-mono text-sm font-bold tabular text-ink">{format(totals[active!])}</p>}
                  <ul className="space-y-0.5">
                    {series.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs">
                        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: tip.color ?? s.color }} />
                        <span className={cx("font-mono tabular text-ink whitespace-nowrap", series.length === 1 && "text-sm font-bold")}>{format(tip.values[s.id] ?? 0)}</span>
                        {series.length > 1 && <span className="text-muted-foreground">{s.name}</span>}
                      </li>
                    ))}
                    {tip.extra?.map((e) => (
                      <li key={e.name} className="flex items-center gap-2 text-xs pl-5">
                        <span className="font-mono tabular text-ink-2 whitespace-nowrap">{e.value}</span>
                        <span className="text-muted-foreground truncate">{e.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* x axis */}
            <div className="flex mt-1.5 font-mono text-[11px] text-muted-foreground tabular" aria-hidden>
              {columns.map((c, i) => (
                <span key={c.key} className="flex-1 min-w-0 text-center whitespace-nowrap overflow-visible">
                  {i % every === 0 ? c.label : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setTable((v) => !v)}
        aria-expanded={table}
        aria-controls={tableId}
        className="mt-3 h-8 -ml-1 px-1 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        {table ? "Ver gráfico" : "Ver tabla"}
      </button>
    </div>
  );
}

function ChartTable({ id, columns, series, format, head }: { id: string; columns: Column[]; series: Series[]; format: (n: number) => string; head: string }) {
  const th = "font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium pb-2";
  return (
    <div id={id} className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>
            <th className={cx(th, "text-left")}>{head}</th>
            {series.map((s) => (
              <th key={s.id} className={cx(th, "text-right")}>
                {s.name}
              </th>
            ))}
            {series.length > 1 && <th className={cx(th, "text-right")}>Total</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {columns.map((c) => (
            <tr key={c.key}>
              <td className="py-2 first-letter:uppercase">{c.title}</td>
              {series.map((s) => (
                <td key={s.id} className="py-2 text-right font-mono tabular">
                  {format(c.values[s.id] ?? 0)}
                </td>
              ))}
              {series.length > 1 && (
                <td className="py-2 text-right font-mono tabular font-semibold">{format(series.reduce((a, s) => a + (c.values[s.id] ?? 0), 0))}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One whole split into ≤ 6 parts: a 28px bar of blocks with their share printed inside, and a legend. */
export function SegmentedBar({ parts, format, ariaLabel }: { parts: { id: string; name: string; value: number; color: string }[]; format: (n: number) => string; ariaLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = useMemo(() => parts.filter((p) => p.value > 0), [parts]);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  if (!total) return <p className="text-sm text-muted-foreground py-4 text-center">Sin pagos en el período.</p>;

  return (
    <div>
      <div className="flex h-7 gap-[2px]" role="group" aria-label={ariaLabel}>
        {shown.map((p) => {
          const share = pct(p.value);
          return (
            <button
              key={p.id}
              type="button"
              onPointerEnter={() => setActive(p.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(p.id)}
              onBlur={() => setActive(null)}
              aria-label={`${p.name}: ${format(p.value)}, ${share}%`}
              className="relative h-full min-w-[3px] rounded-[4px] flex items-center px-2 font-mono text-xs font-bold text-[#0b0817] tabular outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-[filter] duration-100"
              style={{ flexGrow: p.value, flexBasis: 0, background: p.color, filter: active === p.id ? "brightness(1.15)" : undefined }}
            >
              {share >= 12 && <span aria-hidden>{share}%</span>}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-3 text-sm">
        {shown.map((p) => (
          <li key={p.id} className={cx("flex items-center gap-2 rounded-md px-1 -mx-1 transition-colors duration-100", active === p.id && "bg-foreground/[0.05]")}>
            <span aria-hidden className="size-2.5 rounded-[3px] shrink-0" style={{ background: p.color }} />
            <span className="text-ink-2">{p.name}</span>
            <span className="ml-auto sm:ml-1 font-mono tabular text-ink">{format(p.value)}</span>
            {pct(p.value) < 12 && <span className="font-mono tabular text-muted-foreground text-xs">{pct(p.value)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
