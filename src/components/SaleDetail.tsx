"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs, dateTime } from "@/lib/format";
import type { Payment, Sale } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label, Modal, Spinner, StatusBadge } from "./ui";

export function ProofImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getApi()
      .proofUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);
  if (failed) return <div className="text-xs text-bad p-3">No se pudo cargar la imagen</div>;
  if (!url)
    return (
      <div className="grid place-items-center p-6">
        <Spinner />
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Comprobante de pago" className={className ?? "w-full max-h-[50vh] object-contain"} />
      <span className="absolute top-2 right-2 hidden group-hover:inline-flex items-center gap-1 rounded bg-bg/80 px-2 py-1 text-xs text-ink-2">
        <ExternalLink size={12} /> Abrir
      </span>
    </a>
  );
}

/** Verify / reject buttons for one pending payment (admin). */
export function VerifyActions({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (status: "verified" | "rejected") => {
    setBusy(true);
    try {
      await getApi().setPaymentStatus(payment.id, status, reason);
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  if (rejecting)
    return (
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Input autoFocus placeholder="Motivo (ej. no llegó la transferencia)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => act("rejected")}>
            Rechazar
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  return (
    <div className="flex gap-2">
      <Button variant="ok" disabled={busy} onClick={() => act("verified")}>
        <Check size={16} /> Verificado
      </Button>
      <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)}>
        <X size={16} /> Rechazar
      </Button>
    </div>
  );
}

export function SaleDetail({ sale, onClose, onChanged }: { sale: Sale | null; onClose: () => void; onChanged: () => void }) {
  const { isAdmin } = useAuth();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setVoiding(false);
    setReason("");
  }, [sale?.id]);
  if (!sale) return null;

  const doVoid = async () => {
    try {
      await getApi().voidSale(sale.id, reason.trim());
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <Modal open={!!sale} onClose={onClose} title={`Venta · ${dateTime(sale.created_at)}`} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
            <span>Por: <span className="text-ink">{sale.created_by_name ?? "—"}</span></span>
            {sale.table_label && <span>Mesa: <span className="text-ink">{sale.table_label}</span></span>}
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {sale.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>
                  {i.qty} × {i.name}
                </span>
                <span className="tabular">{bs(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-ink-2">Total</span>
            <span className="text-xl font-semibold tabular">{bs(sale.total)}</span>
          </div>
          {sale.note && <p className="text-sm text-ink-2">Nota: {sale.note}</p>}
          {sale.status === "void" && (
            <p className="text-sm rounded-lg border border-line bg-surface-2 p-3">
              <StatusBadge status="void" /> <span className="ml-2 text-ink-2">{sale.void_reason}</span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          {sale.payments.map((p) => (
            <div key={p.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{METHOD_LABEL[p.method]}</p>
                  <p className="text-lg font-semibold tabular">{bs(p.amount)}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.reference && <p className="text-sm text-ink-2">Referencia: <span className="text-ink font-mono">{p.reference}</span></p>}
              {p.status === "rejected" && p.reject_reason && <p className="text-sm text-bad">Motivo: {p.reject_reason}</p>}
              {p.proof_path ? (
                <div className="rounded-lg border border-line overflow-hidden bg-surface-2">
                  <ProofImage path={p.proof_path} />
                </div>
              ) : (
                p.method === "qr" && <p className="text-sm text-muted">Sin comprobante adjunto.</p>
              )}
              {isAdmin && p.status === "pending" && sale.status !== "void" && (
                <VerifyActions
                  payment={p}
                  onDone={() => {
                    onChanged();
                    onClose();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && sale.status !== "void" && (
        <div className="mt-6 pt-4 border-t border-line">
          {voiding ? (
            <div className="space-y-2">
              <Label>Motivo de anulación</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. error al registrar" />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={!reason.trim()} onClick={doVoid}>
                    Anular venta
                  </Button>
                  <Button variant="ghost" onClick={() => setVoiding(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-bad" onClick={() => setVoiding(true)}>
              Anular venta
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
