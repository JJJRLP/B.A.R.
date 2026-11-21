"use client";

import { bs } from "@/lib/format";
import type { CostSummary, PlanRow, ProductRow, PromoterRow } from "@/lib/analytics";
import { Card, cx } from "./primitives";

const th = "font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium pb-2";

/** Entry plans: units sold, people (entradas incluidas), presale, amount and limit status. */
export function PlansTable({ rows, title = "Planes de la noche" }: { rows: PlanRow[]; title?: string }) {
  const people = rows.reduce((a, r) => a + r.people, 0);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-ink-2 font-mono tabular">
          {people} {people === 1 ? "persona" : "personas"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin entradas vendidas.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr>
                <th className={cx(th, "text-left")}>Plan</th>
                <th className={cx(th, "text-right")}>Vendidos</th>
                <th className={cx(th, "text-right")}>Personas</th>
                <th className={cx(th, "text-right")}>Preventa</th>
                <th className={cx(th, "text-right")}>Monto</th>
                <th className={cx(th, "text-right")}>Cupo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const full = r.limit != null && r.units >= r.limit;
                return (
                  <tr key={r.product_id}>
                    <td className="py-2.5 font-medium">{r.name}</td>
                    <td className="py-2.5 text-right font-mono tabular">{r.units}</td>
                    <td className="py-2.5 text-right font-mono tabular font-semibold">{r.people}</td>
                    <td className="py-2.5 text-right font-mono tabular text-ink-2">{r.presaleUnits || "—"}</td>
                    <td className="py-2.5 text-right font-mono tabular">{bs(r.amount)}</td>
                    <td className={cx("py-2.5 text-right font-mono tabular", full ? "text-bad font-medium" : "text-ink-2")}>
                      {r.limit == null ? "—" : full ? "Agotado" : `${r.units} de ${r.limit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Best-selling bar products, with bars scaled to the top seller. */
export function TopProducts({ rows, limit = 8 }: { rows: ProductRow[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.qty));
  return (
    <Card className="p-5">
      <h2 className="font-semibold mb-4">Más vendidos en barra</h2>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin ventas de barra.</p>
      ) : (
        <ol className="space-y-3">
          {top.map((r, i) => (
            <li key={r.product_id} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  <span className="text-muted-foreground font-mono tabular mr-2">{i + 1}.</span>
                  {r.name}
                </span>
                <span className="font-mono tabular shrink-0">
                  <span className="font-semibold">{r.qty}</span> <span className="text-muted-foreground">· {bs(r.amount)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${(r.qty / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Performance per código de relacionador. */
export function PromotersTable({ rows }: { rows: PromoterRow[] }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold mb-4">Relacionadores</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Ninguna venta con código de relacionador.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={cx(th, "text-left")}>Código</th>
              <th className={cx(th, "text-right")}>Ventas</th>
              <th className={cx(th, "text-right")}>Personas</th>
              <th className={cx(th, "text-right")}>Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="py-2.5 font-mono">{r.code}</td>
                <td className="py-2.5 text-right font-mono tabular text-ink-2">{r.sales}</td>
                <td className="py-2.5 text-right font-mono tabular font-semibold">{r.people}</td>
                <td className="py-2.5 text-right font-mono tabular">{bs(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Cost and margin from the unit costs recorded on products. */
export function CostCard({ summary, products }: { summary: CostSummary; products: ProductRow[] }) {
  const pct = summary.costedRevenue > 0 ? Math.round((summary.margin / summary.costedRevenue) * 100) : null;
  const withCost = products.filter((p) => p.cost != null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
  return (
    <Card className="p-5">
      <h2 className="font-semibold mb-4">Costos y margen</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Ventas con costo</p>
          <p className="text-lg font-semibold font-mono tabular">{bs(summary.costedRevenue)}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Costo</p>
          <p className="text-lg font-semibold font-mono tabular">{bs(summary.cost)}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Margen</p>
          <p className={cx("text-lg font-semibold font-mono tabular", summary.margin >= 0 ? "text-ok" : "text-bad")}>
            {bs(summary.margin)}
            {pct != null && <span className="text-sm text-ink-2 font-normal"> · {pct}%</span>}
          </p>
        </div>
      </div>
      {withCost.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={cx(th, "text-left")}>Producto</th>
              <th className={cx(th, "text-right")}>Ventas</th>
              <th className={cx(th, "text-right")}>Costo</th>
              <th className={cx(th, "text-right")}>Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {withCost.slice(0, 8).map((r) => (
              <tr key={r.product_id}>
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right font-mono tabular">{bs(r.amount)}</td>
                <td className="py-2 text-right font-mono tabular text-ink-2">{bs(r.cost ?? 0)}</td>
                <td className="py-2 text-right font-mono tabular font-medium">{bs(r.margin ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {summary.uncostedItems > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {summary.uncostedItems} {summary.uncostedItems === 1 ? "línea vendida no tiene" : "líneas vendidas no tienen"} costo registrado y no entran en el margen. Agrega el costo en Productos.
        </p>
      )}
    </Card>
  );
}
