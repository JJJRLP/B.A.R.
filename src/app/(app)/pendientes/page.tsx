"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs, dateTime } from "@/lib/format";
import type { Sale } from "@/lib/types";
import { Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { ProofImage, SaleDetail, VerifyActions } from "@/components/SaleDetail";

export default function PendingPage() {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setSales(await getApi().listPending());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSales([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPending = (sales ?? []).reduce((a, s) => a + s.payments.reduce((b, p) => b + p.amount, 0), 0);

  return (
    <div>
      <PageHeader
        title="Pagos pendientes"
        subtitle={sales && sales.length > 0 ? `${sales.length} por verificar · ${bs(totalPending)}` : "Revisa cada monto en la app del banco antes de verificar."}
      />
      {sales && sales.length > 0 && (
        <ol className="mb-5 grid gap-2 sm:grid-cols-3 text-sm">
          {[
            "Abre la app del banco del bar.",
            "Busca un ingreso con el mismo monto y hora (o la referencia).",
            "Si llegó, toca Verificado. Si no, Rechazar con el motivo.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-ink-2">
              <span className="h-5 w-5 shrink-0 rounded-full bg-accent/15 text-accent text-[11px] font-semibold grid place-items-center">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-sm text-bad mb-3">{error}</p>}

      {!sales ? (
        <div className="py-14 grid place-items-center">
          <Spinner />
        </div>
      ) : sales.length === 0 ? (
        <Card>
          <Empty icon={<CheckCircle2 size={28} />} title="Todo verificado" hint="No hay pagos QR/transferencia esperando revisión." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {sales.map((s) =>
            s.payments.map((p) => (
              <Card key={p.id} className="overflow-hidden flex flex-col">
                <button onClick={() => setSelected(s)} className="block bg-surface-2 border-b border-line h-56 overflow-hidden">
                  {p.proof_path ? (
                    <ProofImage path={p.proof_path} className="h-56 w-full object-contain pointer-events-none" />
                  ) : (
                    <div className="h-full grid place-items-center text-sm text-muted">Sin comprobante</div>
                  )}
                </button>
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold tabular">{bs(p.amount)}</p>
                      <p className="text-xs text-muted">
                        {dateTime(s.created_at)} · {s.created_by_name ?? "—"}
                        {s.table_label ? ` · ${s.table_label}` : ""}
                      </p>
                    </div>
                    {Math.abs(p.amount - s.total) > 0.009 && (
                      <span className="text-xs text-warn text-right">Total venta {bs(s.total)}</span>
                    )}
                  </div>
                  {p.reference && (
                    <p className="text-sm text-ink-2">
                      Ref. <span className="font-mono text-ink">{p.reference}</span>
                    </p>
                  )}
                  <p className="text-xs text-ink-2 line-clamp-2">{s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                  <div className="mt-auto pt-1">
                    <VerifyActions payment={p} onDone={load} />
                  </div>
                </div>
              </Card>
            )),
          )}
        </div>
      )}

      <SaleDetail sale={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}
