"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Banknote, CalendarDays, ChevronDown, CreditCard, GlassWater, IdCard, ImagePlus, Minus, Plus, QrCode, Search, Ticket, Trash2, UserSearch, X } from "lucide-react";
import { getApi } from "@/lib/data";
import { addDays, bs, businessDay, dateTime, effectivePrice, isFreeNow, longDay } from "@/lib/format";
import { compressImage, hashFile } from "@/lib/image";
import type { DuplicateMatch, PaymentMethod, Product, ProductType } from "@/lib/types";
import { Button, Empty, Input, Label, Modal, Spinner, cx } from "@/components/primitives";
import { toast } from "sonner";
import { DoorLookup } from "@/components/DoorLookup";

type Cart = Record<string, number>; // product id -> qty
type Ink = "pink" | "cyan" | "violet";

const METHODS: { id: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { id: "qr", label: "QR / Transf.", icon: QrCode },
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "card", label: "Tarjeta", icon: CreditCard },
];

// Fixed ink meanings (Sello UV): pink = single entries, cyan = tables, violet = presale.
const INK_BG: Record<Ink, string> = { pink: "bg-ink-pink", cyan: "bg-ink-cyan", violet: "bg-ink-violet" };
const INK_BORDER: Record<Ink, string> = { pink: "border-ink-pink", cyan: "border-ink-cyan", violet: "border-ink-violet" };
const INK_TEXT: Record<Ink, string> = { pink: "text-ink-pink", cyan: "text-ink-cyan", violet: "text-ink-violet" };
// 24 h La Paz clock for the status line (short and unambiguous at night)
const clock = (iso: string) => new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const inkOf = (p: Product, presale: boolean): Ink => (presale ? "violet" : (p.people_per_unit ?? 1) > 1 ? "cyan" : "pink");

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [category, setCategory] = useState<string>("Todas");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [stamp, setStamp] = useState<{ id: number; amount: number; at: string; presale: boolean } | null>(null);

  useEffect(() => {
    getApi()
      .listProducts()
      .then(setProducts)
      .catch((e) => toast.error(e.message));
  }, []);

  // Preventa: entries sold now for a later night ("" = sale at the door for tonight)
  const [presaleDay, setPresaleDay] = useState("");
  const priceOf = useCallback(
    (p: Product) => (presaleDay && p.type === "entrada" ? p.presale_price ?? p.price : effectivePrice(p)),
    [presaleDay],
  );

  // Entries sold for the night being sold (all devices) for the per-night limits, refreshed every 30 s.
  // The tick also re-renders so a "free until 23:00" price and the clock switch on time.
  const [sold, setSold] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => new Date().toISOString());
  const refreshSold = useCallback(() => {
    getApi()
      .entryCounts(presaleDay || undefined)
      .then(setSold)
      .catch(() => {});
  }, [presaleDay]);
  useEffect(() => {
    refreshSold();
    const t = setInterval(() => {
      refreshSold();
      setNow(new Date().toISOString());
    }, 30_000);
    return () => clearInterval(t);
  }, [refreshSold]);
  const remaining = (p: Product) => (p.type === "entrada" && p.max_per_night ? p.max_per_night - (sold[p.id] ?? 0) - (cart[p.id] ?? 0) : Infinity);

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
    if (m === "consumo") setPresaleDay(""); // presale is for entries only
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
  const total = lines.reduce((a, l) => a + priceOf(l.product) * l.qty, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const cartPeople = lines.reduce((a, l) => a + (l.product.type === "entrada" ? l.qty * (l.product.people_per_unit ?? 1) : 0), 0);
  const nightPeople = (products ?? []).reduce((a, p) => a + (p.type === "entrada" ? (sold[p.id] ?? 0) * (p.people_per_unit ?? 1) : 0), 0);
  const anyLive = shown.some((p) => (cart[p.id] ?? 0) > 0);

  const add = (id: string, d = 1) => {
    const p = products?.find((x) => x.id === id);
    if (d > 0 && p && remaining(p) < d) {
      toast.error(`Cupo agotado para ${p.name}`);
      return;
    }
    setCart((c) => {
      const qty = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c, [id]: qty };
      if (!qty) delete next[id];
      return next;
    });
  };

  // Signature moment: a saved sale lands the PAGADO stamp.
  const onSaved = useCallback(
    (amount: number) => {
      setCart({});
      setSheetOpen(false);
      refreshSold();
      setStamp({ id: Date.now(), amount, at: new Date().toISOString(), presale: !!presaleDay });
    },
    [refreshSold, presaleDay],
  );
  useEffect(() => {
    if (!stamp) return;
    const t = setTimeout(() => setStamp(null), 1800);
    return () => clearTimeout(t);
  }, [stamp]);

  const summary = mode === "entrada" || cartPeople > 0 ? `${count} ${count === 1 ? "ítem" : "ítems"} · ${cartPeople} ${cartPeople === 1 ? "persona" : "personas"}` : `${count} ${count === 1 ? "ítem" : "ítems"}`;

  const checkout = (
    <Checkout
      lines={lines}
      total={total}
      priceOf={priceOf}
      presaleDay={presaleDay}
      onAdd={add}
      onClear={() => setCart({})}
      onSaved={onSaved}
      onError={(msg) => toast.error(msg)}
    />
  );

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
      <section className="min-w-0">
        <h1 className="sr-only">Nueva venta</h1>

        {/* Door / bar switch: two large segments */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(
            [
              { m: "entrada", label: "Puerta", sub: "Entradas", icon: Ticket },
              { m: "consumo", label: "Barra", sub: "Consumo", icon: GlassWater },
            ] as const
          ).map(({ m, label, sub, icon: Icon }) => {
            const n = cartCount(m);
            const on = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={on}
                className={cx(
                  "h-14 rounded-2xl px-4 flex items-center gap-3 transition-[background-color,color,transform] duration-100 ease-out active:scale-[0.98]",
                  on ? "bg-foreground text-background" : "bg-card text-ink-2 hover:text-ink",
                )}
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-left leading-tight">
                  <span className="block font-bold text-base">{label}</span>
                  <span className={cx("block text-xs", on ? "text-background/70" : "text-muted-foreground")}>{sub}</span>
                </span>
                {n > 0 && (
                  <span className={cx("ml-auto min-w-7 h-7 px-2 rounded-full font-mono text-sm font-bold grid place-items-center", on ? "bg-background text-foreground" : "bg-primary text-primary-foreground")}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status line: who's in tonight, the time, and the door's tools */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
          <p className="font-mono text-xs tracking-[0.1em] uppercase text-muted-foreground">
            {mode === "entrada" ? (
              <>
                {presaleDay ? "Preventa" : "Puerta"} · <span className="text-ink">{nightPeople}</span> {presaleDay ? "para esa noche" : "dentro"}
              </>
            ) : (
              <>Barra · {ofMode.length} productos</>
            )}
            {/* on phones the time lives in the header beside the DEMO mark */}
            <span className="hidden md:inline">
              <span className="mx-2 text-muted-foreground/50">·</span>
              {clock(now)}
            </span>
          </p>
          {mode === "entrada" && (
            <Button size="sm" onClick={() => setLookupOpen(true)}>
              <UserSearch size={16} /> Verificar reserva
            </Button>
          )}
        </div>

        {mode === "entrada" && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-card">
              <button
                onClick={() => setPresaleDay("")}
                aria-pressed={!presaleDay}
                className={cx("h-9 px-3.5 rounded-lg text-sm font-medium", !presaleDay ? "bg-secondary text-ink" : "text-ink-2 hover:text-ink")}
              >
                En puerta
              </button>
              <button
                onClick={() => setPresaleDay(presaleDay || addDays(businessDay(), 1))}
                aria-pressed={!!presaleDay}
                className={cx("h-9 px-3.5 rounded-lg text-sm font-medium flex items-center gap-1.5", presaleDay ? "bg-ink-violet text-background" : "text-ink-2 hover:text-ink")}
              >
                <CalendarDays size={15} /> Preventa
              </button>
            </div>
            {presaleDay && (
              <label className="flex items-center gap-2 text-sm text-ink-2">
                noche del
                <span className="w-40">
                  <Input type="date" value={presaleDay} min={businessDay()} onChange={(e) => e.target.value && setPresaleDay(e.target.value)} className="h-9 font-mono" />
                </span>
              </label>
            )}
          </div>
        )}

        {mode === "consumo" && (
          <>
            <div className="relative mb-3">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar producto" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11 h-12 text-base rounded-xl bg-card" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={c === category}
                  className={cx(
                    "shrink-0 h-9 rounded-full px-4 text-sm font-medium transition-colors duration-100",
                    c === category ? "bg-foreground text-background" : "bg-card text-ink-2 hover:text-ink",
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
            icon={mode === "entrada" ? <Ticket size={28} /> : <GlassWater size={28} />}
            title={mode === "entrada" ? "Sin tipos de entrada" : "Sin productos"}
            hint={ofMode.length ? "Prueba otra búsqueda o categoría." : "Un administrador debe crearlos en Productos."}
          />
        ) : mode === "entrada" ? (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2 max-w-2xl 2xl:max-w-none">
            {shown.map((p) => (
              <EntryRow
                key={p.id}
                p={p}
                qty={cart[p.id] ?? 0}
                price={priceOf(p)}
                ink={inkOf(p, !!presaleDay)}
                freeNow={!presaleDay && p.price > 0 && isFreeNow(p.free_until)}
                presale={!!presaleDay}
                left={remaining(p)}
                dim={anyLive && !(cart[p.id] ?? 0)}
                onAdd={add}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {shown.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className={cx(
                    "relative text-left rounded-2xl p-4 min-h-24 flex flex-col justify-between transition-[background-color,transform] duration-100 active:scale-[0.97]",
                    qty ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                  )}
                >
                  <span className="text-[15px] font-semibold leading-snug pr-8 line-clamp-2 [overflow-wrap:anywhere]">{p.name}</span>
                  <span className={cx("font-mono text-sm mt-3", qty ? "text-primary-foreground/80" : "text-ink-2")}>{bs(p.price)}</span>
                  {qty > 0 && (
                    <span className="absolute top-3 right-3 min-w-7 h-7 px-1.5 rounded-full bg-primary-foreground text-primary font-mono text-sm font-bold grid place-items-center">{qty}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* room for the charge bar on phones and tablets */}
        {count > 0 && <div className="h-36 xl:hidden" aria-hidden />}
      </section>

      {/* Checkout (desktop) */}
      <aside className="hidden xl:block">
        <div className="sticky top-7 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-card">{checkout}</div>
      </aside>

      {/* Charge bar (phones and tablets): the money is the biggest thing on screen */}
      {count > 0 && (
        <div className="xl:hidden fixed inset-x-0 md:left-60 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-20 px-4 pt-3 pb-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background border-t border-line">
          <div className="flex items-end justify-between mb-3">
            <span className="font-mono text-xs tracking-[0.1em] uppercase text-muted-foreground pb-1">{summary}</span>
            <span className="text-4xl font-extrabold tracking-[-0.03em] leading-none tabular">{bs(total)}</span>
          </div>
          <Button variant="primary" size="lg" className="w-full h-14 text-lg font-bold rounded-2xl" onClick={() => setSheetOpen(true)}>
            Cobrar
          </Button>
        </div>
      )}
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title={presaleDay ? "Cobrar preventa" : "Cobrar venta"} fullOnMobile>
        <div className="-m-5">{checkout}</div>
      </Modal>

      <DoorLookup open={lookupOpen} onClose={() => setLookupOpen(false)} />

      {/* The stamp */}
      <div role="status" aria-live="polite" className="sr-only">
        {stamp ? `${stamp.presale ? "Preventa" : "Venta"} de ${bs(stamp.amount)} guardada` : ""}
      </div>
      {stamp && <Stamp key={stamp.id} amount={stamp.amount} at={stamp.at} presale={stamp.presale} />}
    </div>
  );
}

/** A wristband: the plan's ink as a closed band with its snap, the leading mark of every plan row. */
function Wristband({ ink, live, dim }: { ink: Ink; live: boolean; dim?: boolean }) {
  return (
    <span aria-hidden className={cx("relative h-12 w-4 rounded-full shrink-0 transition-opacity duration-100", live ? "bg-background" : INK_BG[ink], dim && "opacity-35")}>
      <span className={cx("absolute left-1/2 top-2 -translate-x-1/2 size-1.5 rounded-full", live ? INK_BG[ink] : "bg-background")} />
    </span>
  );
}

function EntryRow({
  p,
  qty,
  price,
  ink,
  freeNow,
  presale,
  left,
  dim,
  onAdd,
}: {
  p: Product;
  qty: number;
  price: number;
  ink: Ink;
  freeNow: boolean;
  presale: boolean;
  left: number;
  dim: boolean;
  onAdd: (id: string, d: number) => void;
}) {
  const live = qty > 0;
  const soldOut = left <= 0 && !live;
  const people = p.people_per_unit ?? 1;
  return (
    <div
      className={cx(
        "rounded-2xl min-h-[76px] py-2.5 pl-4 pr-3 flex items-center gap-3.5 transition-[background-color,opacity,transform] duration-100",
        live ? cx(INK_BG[ink], "text-background -translate-y-0.5") : "bg-card",
        soldOut && "opacity-40",
      )}
    >
      {/* while another plan is live, the rest step back through band and name only; controls stay full strength */}
      <Wristband ink={ink} live={live} dim={dim} />
      <div className="flex-1 min-w-0">
        <p className={cx("font-bold text-[17px] leading-tight line-clamp-2 [overflow-wrap:anywhere] transition-colors duration-100", dim && "text-ink-2")}>
          {p.name}
          {people > 1 && <span className={cx("ml-2 font-mono text-xs font-medium", live ? "text-background/70" : "text-muted-foreground")}>×{people}</span>}
        </p>
        <p className={cx("text-sm mt-0.5 leading-snug", live ? "text-background/75" : "text-ink-2")}>
          {price === 0 ? <span className={live ? "font-bold" : "text-ok font-semibold"}>Gratis</span> : <span className="font-mono">{bs(price)}</span>}
          {presale && p.presale_price != null && p.presale_price !== p.price && <span className="ml-1.5 font-mono text-xs line-through opacity-70">{bs(p.price)}</span>}
          {freeNow && <span> · hasta {p.free_until}, luego {bs(p.price)}</span>}
          {p.max_per_night != null && (
            <span className={cx(!live && (left <= 0 ? "text-bad" : left <= 10 ? "text-warn" : ""))}>
              {" · "}
              {left <= 0 ? "agotado" : `quedan ${left}`}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onAdd(p.id, -1)}
          disabled={!qty}
          className={cx(
            "size-12 rounded-xl grid place-items-center disabled:opacity-30 transition-[background-color,transform] duration-100 ease-out active:scale-[0.92]",
            live ? "bg-background/90 text-foreground" : "bg-secondary text-ink hover:bg-secondary/70",
          )}
          aria-label={`Quitar una ${p.name}`}
        >
          <Minus size={20} />
        </button>
        <span className="w-8 text-center font-mono text-[22px] font-bold tabular" aria-live="polite">
          {qty}
        </span>
        <button
          onClick={() => onAdd(p.id, 1)}
          disabled={left <= 0}
          className={cx(
            "size-12 rounded-xl grid place-items-center disabled:opacity-30 transition-[background-color,transform] duration-100 ease-out active:scale-[0.92]",
            live ? "bg-background text-foreground" : "bg-foreground text-background hover:bg-foreground/90",
          )}
          aria-label={`Agregar una ${p.name}`}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

/** PAGADO: the club-door hand stamp, pressed onto the screen when a sale is saved. */
function Stamp({ amount, at, presale }: { amount: number; at: string; presale: boolean }) {
  const ink: Ink = presale ? "violet" : "pink";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
      <div className={cx("size-48 rounded-full border-[6px] grid place-items-center animate-stamp bg-background shadow-[0_12px_40px_rgb(11_8_23/0.55)]", INK_BORDER[ink], INK_TEXT[ink])}>
        <div className={cx("size-[164px] rounded-full border-2 flex flex-col items-center justify-center gap-1", INK_BORDER[ink])}>
          <span className="text-[32px] font-extrabold tracking-[-0.02em] leading-none">{presale ? "PREVENTA" : "PAGADO"}</span>
          <span className="font-mono text-[13px] font-bold leading-tight text-center whitespace-nowrap">
            {clock(at)}
            <br />
            {bs(amount)}
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em]">DEMO</span>
        </div>
      </div>
    </div>
  );
}

function Checkout({
  lines,
  total,
  priceOf,
  presaleDay,
  onAdd,
  onClear,
  onSaved,
  onError,
}: {
  lines: { product: Product; qty: number }[];
  total: number;
  priceOf: (p: Product) => number;
  presaleDay: string;
  onAdd: (id: string, d: number) => void;
  onClear: () => void;
  onSaved: (amount: number) => void;
  onError: (msg: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("qr");
  const [promoterCode, setPromoterCode] = useState("");
  const barInPresale = !!presaleDay && lines.some((l) => l.product.type !== "entrada");
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCi, setCustomerCi] = useState("");
  const [guestsText, setGuestsText] = useState("");
  const entryLines = lines.filter((l) => l.product.type === "entrada");
  const hasEntries = entryLines.length > 0;
  const people = entryLines.reduce((a, l) => a + l.qty * (l.product.people_per_unit ?? 1), 0);
  // one guest per line, optionally "Nombre, CI"
  const guests = guestsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [full_name, ci] = l.split(/\s*[,;]\s*/);
      return { full_name, ci: ci || null };
    });
  const [proof, setProof] = useState<{ file: Blob; hash: string; preview: string } | null>(null);
  const [dups, setDups] = useState<DuplicateMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ciRef = useRef<HTMLInputElement>(null);
  const nameMissing = tried && hasEntries && !customerName.trim();
  const ciMissing = tried && hasEntries && !customerCi.trim();
  const showMore = moreOpen || !!(promoterCode || tableLabel || note);

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
    setCustomerName("");
    setCustomerCi("");
    setGuestsText("");
    setPromoterCode("");
    if (proof) URL.revokeObjectURL(proof.preview);
    setProof(null);
    setDups([]);
    setTried(false);
    setMoreOpen(false);
  };

  const save = async () => {
    if (!lines.length) return;
    if (!(amountNum >= 0)) return onError("Monto inválido");
    if (hasEntries && (!customerName.trim() || !customerCi.trim())) {
      setTried(true);
      // point at the field to fix, not only a toast that may be far from it
      const target = !customerName.trim() ? nameRef.current : ciRef.current;
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
      return onError("Ingresa nombre completo y CI del titular");
    }
    if (barInPresale) return onError("La preventa solo puede incluir entradas: quita los productos de barra");
    setSaving(true);
    try {
      const compressed = proof ? await compressImage(proof.file) : null;
      await getApi().createSale({
        table_label: tableLabel,
        customer: hasEntries ? { name: customerName.trim(), ci: customerCi.trim() } : undefined,
        guests: hasEntries ? guests : [],
        promoter_code: hasEntries ? promoterCode : "",
        presale: presaleDay ? { event_day: presaleDay } : null,
        note,
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        payment: {
          method,
          amount: amountNum,
          reference: method === "qr" ? reference : "",
          confirmed: true, // no verification step for now: checked in person
          proof: method === "qr" && proof && compressed ? { file: compressed, hash: proof.hash } : null,
        },
      });
      reset();
      onSaved(amountNum);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la venta");
    } finally {
      setSaving(false);
    }
  };

  if (!lines.length) {
    return <Empty icon={<Ticket size={28} />} title="Venta vacía" hint="Toca entradas o productos para agregarlos." />;
  }

  return (
    <div className="flex flex-col">
      {/* Lines */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="font-bold">Detalle</h2>
        <button onClick={onClear} className="h-9 -mr-2 px-2 rounded-lg text-sm text-muted-foreground hover:text-bad inline-flex items-center gap-1.5">
          <Trash2 size={15} /> Vaciar
        </button>
      </div>
      <ul className="px-5 divide-y divide-line max-h-[32vh] overflow-y-auto">
        {lines.map(({ product, qty }) => (
          <li key={product.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold truncate">{product.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{priceOf(product) === 0 ? "Gratis" : bs(priceOf(product))}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onAdd(product.id, -1)} className="size-9 rounded-lg bg-secondary grid place-items-center hover:bg-secondary/70" aria-label={`Quitar uno de ${product.name}`}>
                <Minus size={15} />
              </button>
              <span className="w-7 text-center font-mono font-bold">{qty}</span>
              <button onClick={() => onAdd(product.id, 1)} className="size-9 rounded-lg bg-secondary grid place-items-center hover:bg-secondary/70" aria-label={`Agregar uno de ${product.name}`}>
                <Plus size={15} />
              </button>
            </div>
            <span className="w-20 text-right font-mono text-sm">{bs(priceOf(product) * qty)}</span>
          </li>
        ))}
      </ul>
      <div className="mx-5 mt-2 pt-3 border-t border-line flex items-end justify-between">
        <span className="font-mono text-xs tracking-[0.1em] uppercase text-muted-foreground pb-1">Total</span>
        <span className="text-4xl font-extrabold tracking-[-0.03em] leading-none tabular">{bs(total)}</span>
      </div>

      {presaleDay && (
        <div className={cx("mx-5 mt-4 rounded-xl p-3 text-sm flex gap-2.5", barInPresale ? "bg-bad/15 text-bad" : "bg-ink-violet text-background")}>
          <CalendarDays size={18} className="shrink-0 mt-px" />
          <span>
            Preventa para la noche del <span className="inline-block first-letter:uppercase font-bold">{longDay(presaleDay)}</span>.
            {barInPresale && " La preventa solo puede incluir entradas: quita los productos de barra."}
          </span>
        </div>
      )}

      {/* Buyer of the entries */}
      {hasEntries && (
        <div className="mx-5 mt-5 pt-4 border-t border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold flex items-center gap-2">
              <IdCard size={18} className="text-ink-pink" /> Titular
            </p>
            <span className="font-mono text-xs text-ink-2">
              {people} {people === 1 ? "persona" : "personas"}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_128px] gap-2">
            <label className="block">
              <Label>Nombre completo *</Label>
              <Input
                ref={nameRef}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ana Pérez Quispe"
                autoComplete="off"
                aria-invalid={nameMissing || undefined}
                
              />
            </label>
            <label className="block">
              <Label>CI *</Label>
              <Input
                ref={ciRef}
                value={customerCi}
                onChange={(e) => setCustomerCi(e.target.value)}
                placeholder="1234567 LP"
                autoComplete="off"
                aria-invalid={ciMissing || undefined}
                className="font-mono"
              />
            </label>
          </div>
          {people > 1 && (
            <label className="block">
              <Label>Acompañantes (opcional)</Label>
              <textarea
                value={guestsText}
                onChange={(e) => setGuestsText(e.target.value)}
                rows={Math.min(Math.max(people - 1, 2), 6)}
                placeholder={"Un nombre por línea\nOpcional: Nombre, CI"}
                className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-base text-ink placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y"
              />
              <span className="block font-mono text-xs text-muted-foreground mt-1">
                {guests.length} de {people - 1} acompañantes{guests.length > people - 1 ? " · hay más nombres que lugares" : ""}
              </span>
            </label>
          )}
        </div>
      )}

      {/* Payment */}
      <div className="mx-5 mt-5 pt-4 pb-5 border-t border-line space-y-4">
        <div>
          <Label>Cómo pagó</Label>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Método de pago">
            {METHODS.map((m) => {
              const on = method === m.id;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod(m.id)}
                  className={cx(
                    "h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-[background-color,color,transform] duration-100 ease-out active:scale-[0.96]",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-ink-2 hover:text-ink",
                  )}
                >
                  <m.icon size={20} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {method === "qr" && (
          <div className="space-y-3">
            <div>
              <Label>Comprobante (opcional)</Label>
              {proof ? (
                <div className="relative rounded-xl border border-line overflow-hidden bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proof.preview} alt="Comprobante" className="max-h-48 w-full object-contain" />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(proof.preview);
                      setProof(null);
                      runDupCheck(reference, "");
                    }}
                    className="absolute top-2 right-2 size-9 rounded-lg bg-background/85 grid place-items-center text-ink-2 hover:text-ink"
                    aria-label="Quitar comprobante"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-line hover:border-muted-foreground py-5 flex flex-col items-center gap-1.5 text-ink-2"
                >
                  <ImagePlus size={22} />
                  <span className="text-sm font-semibold">Subir captura de WhatsApp</span>
                  <span className="text-xs text-muted-foreground">o pega con Ctrl+V</span>
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
              <Input value={reference} onChange={(e) => setReference(e.target.value)} onBlur={() => runDupCheck(reference, proof?.hash ?? "")} placeholder="884512" className="font-mono" />
            </label>
          </div>
        )}

        <label className="block">
          <Label>Monto recibido</Label>
          <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} placeholder={total.toFixed(2)} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
        </label>

        {/* Optional details, one tap away */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={showMore}
            className="h-10 -ml-1 px-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <ChevronDown size={16} className={cx("transition-transform duration-150", showMore && "rotate-180")} /> Más datos
          </button>
          {showMore && (
            <div className="mt-2 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
              {hasEntries && (
                <label className="block">
                  <Label>Código de relacionador (opcional)</Label>
                  <Input value={promoterCode} onChange={(e) => setPromoterCode(e.target.value.toUpperCase())} placeholder="JUAN10" autoComplete="off" className="font-mono uppercase" />
                </label>
              )}
              <label className="block">
                <Label>Mesa / referencia</Label>
                <Input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Opcional" />
              </label>
              <label className="block">
                <Label>Nota</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
              </label>
            </div>
          )}
        </div>

        {(mismatch || dups.length > 0) && (
          <div className="rounded-xl bg-warn/12 text-warn p-3 space-y-1.5 text-sm" role="alert">
            {mismatch && (
              <p className="flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  El monto ({bs(amountNum)}) no coincide con el total ({bs(total)}).
                </span>
              </p>
            )}
            {dups.map((d) => (
              <p key={d.payment_id} className="flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Posible comprobante duplicado: {d.match === "reference" ? "misma referencia" : "misma imagen"} usado el {dateTime(d.created_at)} por {bs(d.amount)}.
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Save stays pinned to the bottom of the sheet / panel: one thumb, every sale */}
      <div className="sticky bottom-0 z-10 bg-card border-t border-line px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] xl:pb-4">
        <Button variant="primary" size="lg" className="w-full h-14 text-lg font-bold rounded-2xl" disabled={saving} onClick={save}>
          {saving ? "Guardando…" : `Guardar · ${bs(amountNum)}`}
        </Button>
      </div>
    </div>
  );
}
