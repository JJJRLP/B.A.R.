"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Download, History, ShoppingBag } from "lucide-react";
import { getApi } from "@/lib/data";
import { addDays, bs, businessDay, dateTime, longDay, time } from "@/lib/format";
import { ACTIVITY_LABEL, buildActivity, type ActivityEvent, type ActivityKind } from "@/lib/activity";
import { downloadCsv } from "@/lib/csv";
import type { Sale } from "@/lib/types";
import { Button, Card, Empty, Input, Label, PageHeader, Select, Spinner, cx } from "@/components/ui";
import { StaffFilter } from "@/components/StaffFilter";
import { SaleDetail } from "@/components/SaleDetail";

const KIND_STYLE: Record<ActivityKind, { icon: typeof ShoppingBag; cls: string }> = {
  sale: { icon: ShoppingBag, cls: "text-accent bg-accent/10" },
  void: { icon: Ban, cls: "text-bad bg-bad/10" },
};

export default function ActivityPage() {
  const today = businessDay();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [staff, setStaff] = useState("");
  const [kind, setKind] = useState<ActivityKind | "">("");
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);

  // Load a week before the range too: a sale from earlier can be verified or voided inside it.
  const load = useCallback(async () => {
    setSales(null);
    try {
      setSales(await getApi().listSales({ from: addDays(from, -7), to }));
    } catch {
      setSales([]);
    }
  }, [from, to]);
  useEffect(() => {
    load();
  }, [load]);

  const events = useMemo(
    () => buildActivity(sales ?? [], from, to, staff || undefined).filter((e) => !kind || e.kind === kind),
    [sales, from, to, staff, kind],
  );

  const exportCsv = () =>
    downloadCsv(`actividad_${from === to ? from : `${from}_${to}`}.csv`, [
      ["fecha_hora", "persona", "accion", "monto_bs", "detalle", "venta_id"],
      ...events.map((e) => [e.at, e.actorName, ACTIVITY_LABEL[e.kind], e.amount.toFixed(2), e.detail, e.sale.id]),
    ]);

  const multiDay = from !== to;

  return (
    <div>
      <PageHeader
        title="Registro de actividad"
        subtitle="Quién hizo qué, por cuánto y cuándo. Nada se borra: cada venta y anulación queda registrada."
        actions={
          events.length > 0 && (
            <Button size="sm" onClick={exportCsv}>
              <Download size={15} /> CSV
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 mb-5">
        <label>
          <Label>Desde</Label>
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label>
          <Label>Hasta</Label>
          <Input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <StaffFilter value={staff} onChange={setStaff} label="Persona" />
        <label>
          <Label>Acción</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind | "")} className="w-full">
            <option value="">Todas</option>
            {(Object.keys(ACTIVITY_LABEL) as ActivityKind[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABEL[k]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Card className="overflow-hidden">
        {!sales ? (
          <div className="py-14 grid place-items-center">
            <Spinner />
          </div>
        ) : events.length === 0 ? (
          <Empty icon={<History size={28} />} title="Sin actividad" hint={`No hay acciones registradas ${multiDay ? "en este rango" : `el ${longDay(from)}`}.`} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-2/60">
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="text-left font-medium px-4 py-2.5 w-32">{multiDay ? "Fecha" : "Hora"}</th>
                  <th className="text-left font-medium px-4 py-2.5 w-40">Persona</th>
                  <th className="text-left font-medium px-4 py-2.5 w-44">Acción</th>
                  <th className="text-left font-medium px-4 py-2.5">Detalle</th>
                  <th className="text-right font-medium px-4 py-2.5 w-28">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e.id} onClick={() => setSelected(e.sale)} className="cursor-pointer hover:bg-surface-2/60">
                    <td className="px-4 py-3 tabular text-ink-2 whitespace-nowrap">{multiDay ? dateTime(e.at) : time(e.at)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{e.actorName}</td>
                    <td className="px-4 py-3">
                      <KindTag kind={e.kind} />
                    </td>
                    <td className="px-4 py-3 text-ink-2 max-w-0 truncate" title={e.detail}>
                      {e.detail}
                    </td>
                    <td className={cx("px-4 py-3 text-right tabular font-medium", e.kind === "void" && "text-bad")}>{bs(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile list */}
            <ul className="md:hidden divide-y divide-line">
              {events.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelected(e.sale)} className="w-full text-left px-4 py-3 flex gap-3">
                    <KindIcon kind={e.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm">
                          <span className="font-medium">{e.actorName}</span> <span className="text-ink-2">{ACTIVITY_LABEL[e.kind].toLowerCase()}</span>
                        </p>
                        <span className="text-sm tabular font-medium shrink-0">{bs(e.amount)}</span>
                      </div>
                      <p className="text-xs text-muted truncate">
                        {multiDay ? dateTime(e.at) : time(e.at)} · {e.detail}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <SaleDetail sale={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function KindIcon({ kind }: { kind: ActivityKind }) {
  const { icon: Icon, cls } = KIND_STYLE[kind];
  return (
    <span className={cx("h-8 w-8 rounded-lg grid place-items-center shrink-0", cls)}>
      <Icon size={16} />
    </span>
  );
}

function KindTag({ kind }: { kind: ActivityKind }) {
  const { icon: Icon, cls } = KIND_STYLE[kind];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", cls)}>
      <Icon size={13} />
      {ACTIVITY_LABEL[kind]}
    </span>
  );
}

export type { ActivityEvent };
