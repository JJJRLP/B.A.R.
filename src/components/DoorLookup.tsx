"use client";

import { useEffect, useState } from "react";
import { IdCard, Search, Users } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs, time } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { Input, Modal, Spinner, StatusBadge, cx } from "./ui";

/** Door check: find tonight's entry sales by buyer name, CI or guest name. */
export function DoorLookup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Reservation[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
    }
  }, [open]);

  // search as you type (debounced)
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      getApi()
        .findReservation(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const hit = (v?: string | null) => !!needle && !!v && v.toLowerCase().includes(needle);

  return (
    <Modal open={open} onClose={onClose} title="Verificar reserva" wide>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, apellido o CI" className="pl-9 h-11" />
      </div>

      {q.trim().length < 2 ? (
        <p className="text-sm text-muted text-center py-8">Escribe al menos 2 letras o números. Busca al titular, su CI o cualquier acompañante de esta noche.</p>
      ) : loading && !results ? (
        <div className="py-10 grid place-items-center">
          <Spinner />
        </div>
      ) : results && results.length === 0 ? (
        <p className="text-sm text-center py-8">
          <span className="text-bad font-medium">Sin coincidencias esta noche.</span>
          <span className="block text-muted mt-1">Revisa la ortografía o pide el CI del titular.</span>
        </p>
      ) : (
        <ul className="space-y-3">
          {(results ?? []).map((r) => {
            const ok = r.sale_status !== "void" && r.payment_status === "verified";
            return (
              <li key={r.sale_id} className={cx("rounded-xl border p-4", r.sale_status === "void" ? "border-bad/40" : ok ? "border-ok/40" : "border-warn/40")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={cx("font-semibold", hit(r.customer_name) && "text-accent")}>{r.customer_name ?? "Sin nombre"}</p>
                    <p className={cx("text-sm flex items-center gap-1.5", hit(r.customer_ci) ? "text-accent" : "text-ink-2")}>
                      <IdCard size={14} /> CI {r.customer_ci ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.sale_status === "void" ? <StatusBadge status="void" /> : r.payment_status && <StatusBadge status={r.payment_status} />}
                    <p className="text-xs text-muted mt-1">
                      {time(r.created_at)} · {r.sold_by ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {r.is_presale && <span className="rounded-md bg-accent/12 text-accent px-2 py-0.5 text-xs font-medium">Preventa</span>}
                  <span>{r.entries}</span>
                  <span className="text-ink-2 flex items-center gap-1">
                    <Users size={14} /> {r.people} {r.people === 1 ? "persona" : "personas"}
                  </span>
                  <span className="text-ink-2 tabular">{bs(r.total)}</span>
                  {r.promoter_code && <span className="text-ink-2">Relacionador <span className="font-mono text-ink">{r.promoter_code}</span></span>}
                </div>
                {r.guests.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <p className="text-xs uppercase tracking-wide text-muted mb-1.5">Acompañantes</p>
                    <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {r.guests.map((g, i) => (
                        <li key={i} className={cx(hit(g.full_name) || hit(g.ci) ? "text-accent font-medium" : "text-ink-2")}>
                          {g.full_name}
                          {g.ci && <span className="text-muted"> · CI {g.ci}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.sale_status !== "void" && r.payment_status === "pending" && (
                  <p className="mt-3 text-xs text-warn">Pago QR aún sin verificar: revísalo en Pendientes o consulta al administrador antes de dejar pasar.</p>
                )}
                {r.payment_status === "rejected" && <p className="mt-3 text-xs text-bad">Pago rechazado: no dejar pasar.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
