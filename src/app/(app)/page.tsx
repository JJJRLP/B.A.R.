"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Banknote, CreditCard, GlassWater, ImagePlus, Minus, Plus, QrCode, Search, Ticket, Trash2, X } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs, dateTime } from "@/lib/format";
import { compressImage, hashFile } from "@/lib/image";
import type { DuplicateMatch, PaymentMethod, Product, ProductType } from "@/lib/types";
import { Button, Empty, Input, Label, Modal, Spinner, Toast, cx } from "@/components/ui";

type Cart = Record<string, number>; // product id -> qty

const METHODS: { id: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { id: "qr", label: "QR / Transf.", icon: QrCode },
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "card", label: "Tarjeta", icon: CreditCard },
];

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [category, setCategory] = useState<string>("Todas");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "bad" } | null>(null);

  useEffect(() => {
    getApi()
      .listProducts()
      .then(setProducts)
      .catch((e) => setToast({ msg: e.message, kind: "bad" }));
  }, []);

  // Door staff sell entries, bartenders sell drinks: remember each device's last mode.
  const [mode, setModeState] = useState<ProductType>("consumo");
  useEffect(() => {
    try {
      const m = localStorage.getItem("sale-mode");
      if (m === "entrada" || m === "consumo") setModeState(m);
    } catch {}
  }, []);
  const setMode = (m: ProductType) => {
    setModeState(m);
    setCategory("Todas");
    setQuery("");
    try {
      localStorage.setItem("sale-mode", m);
    } catch {}
  };

  const ofMode = useMemo(() => (products ?? []).filter((p) => p.type === mode), [products, mode]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(ofMode.map((p) => p.category)))], [ofMode]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ofMode.filter((p) => (category === "Todas" || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
  }, [ofMode, category, query]);
  const cartCount = (type: ProductType) => (products ?? []).filter((p) => p.type === type).reduce((a, p) => a + (cart[p.id] ?? 0), 0);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products?.find((p) => p.id === id), qty }))
        .filter((l): l is { product: Product; qty: number } => !!l.product && l.qty > 0),
    [cart, products],
  );
  const total = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  const add = (id: string, d = 1) =>
    setCart((c) => {
      const qty = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c, [id]: qty };
      if (!qty) delete next[id];
      return next;
    });

  const onSaved = useCallback((amount: number, method: PaymentMethod) => {
    setCart({});
    setSheetOpen(false);
    setToast({
      msg: method === "qr" ? `Venta de ${bs(amount)} guardada · pago pendiente de verificación` : `Venta de ${bs(amount)} guardada y cobrada`,
      kind: "ok",
    });
  }, []);

  const checkout = (
    <Checkout
      lines={lines}
      total={total}
      onAdd={add}
      onClear={() => setCart({})}
      onSaved={onSaved}
      onError={(msg) => setToast({ msg, kind: "bad" })}
    />
  );

  return (
    <div className="xl:grid xl:grid-cols-[1fr_380px] xl:gap-6">
      {/* Products */}
      <section className="min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nueva venta</h1>
            <p className="text-sm text-ink-2 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <Step n={1} /> Elige entradas o productos <span className="text-muted">·</span> <Step n={2} /> cómo pagó <span className="text-muted">·</span> <Step n={3} /> guarda
            </p>
          </div>
        </div>

        {/* Door / bar switch */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-surface border border-line">
          {(
            [
              { m: "entrada", label: "Puerta · Entradas", icon: Ticket },
              { m: "consumo", label: "Barra · Consumo", icon: GlassWater },
            ] as const
          ).map(({ m, label, icon: Icon }) => {
            const n = cartCount(m);
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx(
                  "h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors",
                  mode === m ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon size={17} />
                {label}
                {n > 0 && (
                  <span className={cx("min-w-5 h-5 px-1.5 rounded-full text-[11px] grid place-items-center tabular", mode === m ? "bg-accent-ink/20" : "bg-accent/15 text-accent")}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "consumo" && (
          <>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input placeholder="Buscar producto" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cx(
                    "shrink-0 h-8 rounded-full px-3.5 text-sm border transition-colors",
                    c === category ? "bg-ink text-bg border-ink" : "border-line text-ink-2 hover:text-ink",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {!products ? (
          <div className="py-16 grid place-items-center">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <Empty
            icon={mode === "entrada" ? <Ticket size={28} /> : undefined}
            title={mode === "entrada" ? "Sin tipos de entrada" : "Sin productos"}
            hint={ofMode.length ? "Prueba otra búsqueda o categoría." : "Un administrador debe crearlos en Productos."}
          />
        ) : mode === "entrada" ? (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 max-w-2xl 2xl:max-w-none">
            {shown.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={cx("rounded-xl border p-4 flex items-center gap-4 transition-colors", qty ? "border-accent/60 bg-accent/[0.06]" : "border-line bg-surface")}
                >
                  <span className="h-11 w-11 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
                    <Ticket size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-sm text-ink-2 tabular">{p.price === 0 ? "Gratis" : bs(p.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => add(p.id, -1)}
                      disabled={!qty}
                      className="h-10 w-10 rounded-lg border border-line grid place-items-center text-ink-2 hover:text-ink disabled:opacity-30"
                      aria-label={`Quitar una ${p.name}`}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold tabular">{qty}</span>
                    <button
                      onClick={() => add(p.id, 1)}
                      className="h-10 w-10 rounded-lg bg-accent text-accent-ink grid place-items-center hover:brightness-110"
                      aria-label={`Agregar una ${p.name}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {shown.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className={cx(
                    "relative text-left rounded-xl border p-3.5 min-h-[88px] flex flex-col justify-between transition-colors active:scale-[0.98]",
                    qty ? "border-accent/60 bg-accent/[0.06]" : "border-line bg-surface hover:border-muted",
                  )}
                >
                  <span className="text-sm font-medium leading-snug pr-6">{p.name}</span>
                  <span className="text-sm text-ink-2 tabular mt-2">{bs(p.price)}</span>
                  {qty > 0 && (
                    <span className="absolute top-2.5 right-2.5 min-w-6 h-6 px-1.5 rounded-full bg-accent text-accent-ink text-xs font-semibold grid place-items-center tabular">
                      {qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Checkout (desktop) */}
      <aside className="hidden xl:block">
        <div className="sticky top-7 rounded-xl border border-line bg-surface">{checkout}</div>
      </aside>

      {/* Checkout bar (mobile/tablet) */}
      {count > 0 && (
        <div className="xl:hidden fixed inset-x-0 md:left-60 bottom-16 md:bottom-0 z-20 p-3 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <Button variant="primary" size="lg" className="w-full" onClick={() => setSheetOpen(true)}>
            <span className="flex-1 text-left">Cobrar · {count} {count === 1 ? "ítem" : "ítems"}</span>
            <span className="tabular">{bs(total)}</span>
          </Button>
        </div>
      )}
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Cobrar venta">
        <div className="-m-5">{checkout}</div>
      </Modal>

      {toast && <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  );
}

function Checkout({
  lines,
  total,
  onAdd,
  onClear,
  onSaved,
  onError,
}: {
  lines: { product: Product; qty: number }[];
  total: number;
  onAdd: (id: string, d: number) => void;
  onClear: () => void;
  onSaved: (amount: number, method: PaymentMethod) => void;
  onError: (msg: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("qr");
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<{ file: Blob; hash: string; preview: string } | null>(null);
  const [dups, setDups] = useState<DuplicateMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const amountNum = amount === "" ? total : Number(amount);
  const mismatch = lines.length > 0 && Math.abs(amountNum - total) > 0.009;

  const runDupCheck = useCallback(async (ref: string, hash: string) => {
    if (!ref.trim() && !hash) return setDups([]);
    try {
      setDups(await getApi().checkDuplicate(ref.trim(), hash));
    } catch {
      setDups([]);
    }
  }, []);

  const takeFile = useCallback(
    async (file: File | Blob) => {
      if (!file.type.startsWith("image/")) return onError("El comprobante debe ser una imagen");
      const hash = await hashFile(file);
      const preview = URL.createObjectURL(file);
      setProof((old) => {
        if (old) URL.revokeObjectURL(old.preview);
        return { file, hash, preview };
      });
      setMethod("qr");
      runDupCheck(reference, hash);
    },
    [onError, reference, runDupCheck],
  );

  // Paste a screenshot copied from WhatsApp (Ctrl/Cmd+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        takeFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [takeFile]);

  const reset = () => {
    setAmount("");
    setReference("");
    setTableLabel("");
    setNote("");
    if (proof) URL.revokeObjectURL(proof.preview);
    setProof(null);
    setDups([]);
  };

  const save = async () => {
    if (!lines.length) return;
    if (!(amountNum >= 0)) return onError("Monto inválido");
    setSaving(true);
    try {
      const compressed = proof ? await compressImage(proof.file) : null;
      await getApi().createSale({
        table_label: tableLabel,
        note,
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        payment: {
          method,
          amount: amountNum,
          reference: method === "qr" ? reference : "",
          proof: method === "qr" && proof && compressed ? { file: compressed, hash: proof.hash } : null,
        },
      });
      reset();
      onSaved(amountNum, method);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la venta");
    } finally {
      setSaving(false);
    }
  };

  if (!lines.length) {
    return <Empty icon={<Plus size={28} />} title="Venta vacía" hint="Toca productos para agregarlos." />;
  }

  return (
    <div className="flex flex-col">
      {/* Lines */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Step n={1} /> Productos
        </h2>
        <button onClick={onClear} className="text-xs text-muted hover:text-bad inline-flex items-center gap-1">
          <Trash2 size={14} /> Vaciar
        </button>
      </div>
      <ul className="px-5 space-y-2 max-h-[30vh] overflow-y-auto">
        {lines.map(({ product, qty }) => (
          <li key={product.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate flex items-center gap-1.5">
                {product.type === "entrada" && <Ticket size={13} className="text-accent shrink-0" />}
                {product.name}
              </p>
              <p className="text-xs text-muted tabular">{bs(product.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onAdd(product.id, -1)} className="h-7 w-7 rounded-md border border-line grid place-items-center text-ink-2 hover:text-ink" aria-label="Quitar uno">
                <Minus size={14} />
              </button>
              <span className="w-7 text-center text-sm tabular">{qty}</span>
              <button onClick={() => onAdd(product.id, 1)} className="h-7 w-7 rounded-md border border-line grid place-items-center text-ink-2 hover:text-ink" aria-label="Agregar uno">
                <Plus size={14} />
              </button>
            </div>
            <span className="w-20 text-right text-sm tabular">{bs(product.price * qty)}</span>
          </li>
        ))}
      </ul>
      <div className="mx-5 mt-3 pt-3 border-t border-line flex items-baseline justify-between">
        <span className="text-sm text-ink-2">Total</span>
        <span className="text-2xl font-semibold tabular">{bs(total)}</span>
      </div>

      {/* Payment */}
      <div className="px-5 pt-5 pb-5 space-y-4">
        <div>
          <Label className="flex items-center gap-2">
            <Step n={2} /> ¿Cómo pagó?
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cx(
                  "h-14 rounded-lg border flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                  method === m.id ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-2 hover:text-ink",
                )}
              >
                <m.icon size={18} className={method === m.id ? "text-accent" : ""} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {method === "qr" && (
          <div className="space-y-3">
            <div>
              <Label>Comprobante del cliente</Label>
              {proof ? (
                <div className="relative rounded-lg border border-line overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proof.preview} alt="Comprobante" className="max-h-48 w-full object-contain" />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(proof.preview);
                      setProof(null);
                      runDupCheck(reference, "");
                    }}
                    className="absolute top-2 right-2 h-7 w-7 rounded-md bg-bg/80 grid place-items-center text-ink-2 hover:text-ink"
                    aria-label="Quitar comprobante"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-line hover:border-muted py-5 flex flex-col items-center gap-1.5 text-ink-2"
                >
                  <ImagePlus size={20} />
                  <span className="text-sm">Subir captura de WhatsApp</span>
                  <span className="text-xs text-muted">o pega con Ctrl+V</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) takeFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <label className="block">
              <Label>N.º de referencia (opcional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} onBlur={() => runDupCheck(reference, proof?.hash ?? "")} placeholder="Ej. 884512" />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Monto recibido</Label>
            <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} placeholder={total.toFixed(2)} onChange={(e) => setAmount(e.target.value)} className="tabular" />
          </label>
          <label className="block">
            <Label>Mesa / cliente</Label>
            <Input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Opcional" />
          </label>
        </div>
        <label className="block">
          <Label>Nota</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </label>

        {(mismatch || dups.length > 0) && (
          <div className="rounded-lg border border-warn/30 bg-warn/[0.07] p-3 space-y-1.5 text-sm">
            {mismatch && (
              <p className="flex gap-2">
                <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
                <span>
                  El monto ({bs(amountNum)}) no coincide con el total ({bs(total)}).
                </span>
              </p>
            )}
            {dups.map((d) => (
              <p key={d.payment_id} className="flex gap-2">
                <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
                <span>
                  Posible comprobante duplicado: {d.match === "reference" ? "misma referencia" : "misma imagen"} usado el {dateTime(d.created_at)} por {bs(d.amount)}.
                </span>
              </p>
            ))}
          </div>
        )}

        <Button variant="primary" size="lg" className="w-full" disabled={saving} onClick={save}>
          {saving ? (
            "Guardando…"
          ) : (
            <>
              <Step n={3} invert /> {method === "qr" ? "Guardar venta" : `Guardar · cobrado ${bs(amountNum)}`}
            </>
          )}
        </Button>
        <p className="text-xs text-muted text-center -mt-2">
          {method === "qr"
            ? proof
              ? "El pago quedará pendiente hasta que el administrador lo verifique en el banco."
              : "Sin comprobante el pago será difícil de verificar. Adjunta la captura si la tienes."
            : "Efectivo y tarjeta se registran como cobrados al guardar."}
        </p>
      </div>
    </div>
  );
}

function Step({ n, invert }: { n: number; invert?: boolean }) {
  return (
    <span
      className={cx(
        "inline-grid place-items-center h-[18px] w-[18px] rounded-full text-[10px] font-semibold shrink-0",
        invert ? "bg-accent-ink text-accent" : "bg-accent/15 text-accent",
      )}
    >
      {n}
    </span>
  );
}
