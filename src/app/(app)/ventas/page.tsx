"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Image as ImageIcon, Receipt } from "lucide-react";
import { getApi } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { bs, businessDay, time, longDay } from "@/lib/format";
import { exportSalesCsv } from "@/lib/csv";
import type { PaymentMethod, PaymentStatus, Sale } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/types";
import { Button, Card, Empty, Input, Label, PageHeader, Select, Spinner, StatusBadge, cx } from "@/components/ui";
import { SaleDetail } from "@/components/SaleDetail";

export default function SalesPage() {
  const { isAdmin } = useAuth();
  const today = businessDay();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setSales(await getApi().listSales({ from, to, method, status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSales([]);
    }
  }, [from, to, method, status]);

  useEffect(() => {
    load();
  }, [load]);

  const active = (sales ?? []).filter((s) => s.status !== "void");
  const total = active.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={<span className="inline-block first-letter:uppercase">{isAdmin ? (from === to ? longDay(from) : `${from} → ${to}`) : `Tus ventas de hoy · ${longDay(today)}`}</span>}
        actions={
          isAdmin &&
          sales &&
          sales.length > 0 && (
            <Button size="sm" onClick={() => exportSalesCsv(sales, from === to ? from : `${from}_${to}`)}>
              <Download size={15} /> CSV
            </Button>
          )
        }
      />

      {isAdmin && (
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 mb-5">
          <label>
            <Label>Desde</Label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <Label>Hasta</Label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            <Label>Método</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")} className="w-full">
              <option value="">Todos</option>
              <option value="qr">QR / Transf.</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
            </Select>
          </label>
          <label>
            <Label>Estado</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")} className="w-full">
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="verified">Verificado</option>
              <option value="rejected">Rechazado</option>
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
          <ul className="divide-y divide-line">
            {sales.map((s) => {
              const p = s.payments[0];
              return (
                <li key={s.id}>
                  <button onClick={() => setSelected(s)} className={cx("w-full text-left px-4 py-3 hover:bg-surface-2/60 flex items-center gap-4", s.status === "void" && "opacity-50")}>
                    <span className="w-12 text-sm text-ink-2 tabular shrink-0">{time(s.created_at)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                      <p className="text-xs text-muted truncate">
                        {p ? METHOD_LABEL[p.method] : "—"}
                        {s.table_label ? ` · ${s.table_label}` : ""}
                        {isAdmin && s.created_by_name ? ` · ${s.created_by_name}` : ""}
                        {from !== to ? ` · ${s.business_day}` : ""}
                      </p>
                    </div>
                    {p?.proof_path && <ImageIcon size={15} className="text-muted shrink-0" aria-label="Con comprobante" />}
                    <span className="hidden sm:block shrink-0">{s.status === "void" ? <StatusBadge status="void" /> : p && <StatusBadge status={p.status} />}</span>
                    <span className="w-24 text-right text-sm font-medium tabular shrink-0">{bs(s.total)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SaleDetail sale={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}
