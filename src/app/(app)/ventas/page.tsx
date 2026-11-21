"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, IdCard, Image as ImageIcon, Receipt, Search } from "lucide-react";
import { getApi } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { bs, businessDay, dateTime, time, longDay } from "@/lib/format";
import { exportSalesCsv } from "@/lib/csv";
import type { PaymentMethod, Sale } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/types";
import { Button, Card, Empty, Input, Label, PageHeader, Select, Spinner, StatusBadge, cx } from "@/components/ui";
import { SaleDetail } from "@/components/SaleDetail";
import { StaffFilter } from "@/components/StaffFilter";

export default function SalesPage() {
  const { isAdmin } = useAuth();
  const today = businessDay();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [staff, setStaff] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setSales(await getApi().listSales({ from, to, method, staff, search: searchDebounced }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSales([]);
    }
  }, [from, to, method, staff, searchDebounced]);

  useEffect(() => {
    load();
  }, [load]);

  const active = (sales ?? []).filter((s) => s.status !== "void");
  const total = active.reduce((a, s) => a + s.total, 0);
  const multiDay = from !== to;
  const subtitle = isAdmin ? (multiDay ? `${from} → ${to}` : longDay(from)) : `Tus ventas de hoy · ${longDay(today)}`;

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={<span className="inline-block first-letter:uppercase">{subtitle}</span>}
        actions={
          isAdmin &&
          sales &&
          sales.length > 0 && (
            <Button size="sm" onClick={() => exportSalesCsv(sales, multiDay ? `${from}_${to}` : from)}>
              <Download size={15} /> CSV
            </Button>
          )
        }
      />

      <div className="relative mb-3 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar titular, acompañante o CI" className="pl-9" />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 mb-5">
          <label>
            <Label>Desde</Label>
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label>
            <Label>Hasta</Label>
            <Input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
          <StaffFilter value={staff} onChange={setStaff} label="Registrado por" />
          <label>
            <Label>Método</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")} className="w-full">
              <option value="">Todos</option>
              <option value="qr">QR / Transf.</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
            </Select>
          </label>
        </div>
      )}

      <div className="flex gap-6 mb-4 text-sm">
        <span className="text-ink-2">
          Ventas: <span className="text-ink tabular">{active.length}</span>
        </span>
        <span className="text-ink-2">
          Total: <span className="text-ink font-medium tabular">{bs(total)}</span>
        </span>
      </div>

      {error && <p className="text-sm text-bad mb-3">{error}</p>}

      <Card className="overflow-hidden">
        {!sales ? (
          <div className="py-14 grid place-items-center">
            <Spinner />
          </div>
        ) : sales.length === 0 ? (
          <Empty icon={<Receipt size={28} />} title="Sin ventas" hint="Las ventas registradas aparecerán aquí." />
        ) : (
          <>
            {/* Desktop: full audit table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-2/60">
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="text-left font-medium px-4 py-2.5 w-28">{multiDay ? "Fecha" : "Hora"}</th>
                  {isAdmin && <th className="text-left font-medium px-4 py-2.5 w-36">Registró</th>}
                  <th className="text-left font-medium px-4 py-2.5">Productos</th>
                  <th className="text-left font-medium px-4 py-2.5 w-32">Método</th>
                  <th className="text-right font-medium px-4 py-2.5 w-28">Monto</th>
                  {isAdmin && <th className="text-left font-medium px-4 py-2.5 w-40">Anulada por</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sales.map((s) => {
                  const p = s.payments[0];
                  const checker =
                    s.status === "void"
                      ? s.voided_by_name && { who: s.voided_by_name, at: s.voided_at }
                      : null;
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} className={cx("cursor-pointer hover:bg-surface-2/60", s.status === "void" && "text-muted")}>
                      <td className="px-4 py-3 tabular text-ink-2 whitespace-nowrap">{multiDay ? dateTime(s.created_at) : time(s.created_at)}</td>
                      {isAdmin && <td className="px-4 py-3 font-medium whitespace-nowrap">{s.created_by_name ?? "—"}</td>}
                      <td className="px-4 py-3 max-w-0">
                        <p className="truncate">{s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                        {(s.customer_name || s.table_label) && (
                          <p className="text-xs text-muted flex items-center gap-1 truncate">
                            {s.customer_name && (
                              <>
                                <IdCard size={12} /> {s.customer_name}
                                {s.customer_ci ? ` · CI ${s.customer_ci}` : ""}
                              </>
                            )}
                            {s.table_label && `${s.customer_name ? " · " : ""}Mesa ${s.table_label}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        <span className="inline-flex items-center gap-1.5">
                          {p ? METHOD_LABEL[p.method] : "—"}
                          {p?.proof_path && <ImageIcon size={13} className="text-muted" aria-label="Con comprobante" />}
                        </span>
                      </td>
                      <td className={cx("px-4 py-3 text-right tabular font-medium", s.status === "void" && "line-through")}>{bs(s.total)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-xs">
                          {checker ? (
                            <>
                              <p className="text-ink">{checker.who}</p>
                              {checker.at && <p className="text-muted tabular">{dateTime(checker.at)}</p>}
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile: compact list */}
            <ul className="md:hidden divide-y divide-line">
              {sales.map((s) => {
                const p = s.payments[0];
                return (
                  <li key={s.id}>
                    <button onClick={() => setSelected(s)} className={cx("w-full text-left px-4 py-3 flex items-center gap-3", s.status === "void" && "opacity-50")}>
                      <span className="w-11 text-sm text-ink-2 tabular shrink-0">{time(s.created_at)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                        <p className="text-xs text-muted truncate">
                          {s.customer_name ? `${s.customer_name} · ` : ""}
                          {isAdmin && s.created_by_name ? `${s.created_by_name} · ` : ""}
                          {p ? METHOD_LABEL[p.method] : "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular">{bs(s.total)}</p>
                        {s.status === "void" && <StatusBadge status="void" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <SaleDetail sale={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}
