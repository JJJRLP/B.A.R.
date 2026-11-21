"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassWater, Package, Pencil, Plus, Ticket } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs } from "@/lib/format";
import type { Product, ProductType } from "@/lib/types";
import { Button, Card, Empty, Input, Label, Modal, PageHeader, Spinner, cx } from "@/components/primitives";
import { toast } from "sonner";

type Draft = Omit<Product, "id"> & { id?: string };
const EMPTY: Draft = { name: "", type: "consumo", category: "", price: 0, active: true, people_per_unit: 1 };

const SECTIONS: { type: ProductType; title: string; hint: string; icon: typeof Ticket }[] = [
  { type: "entrada", title: "Entradas", hint: "Tipos de entrada que se cobran en puerta (General, VIP…).", icon: Ticket },
  { type: "consumo", title: "Barra", hint: "Bebidas y comida.", icon: GlassWater },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setProducts(await getApi().listProducts(true));
  }, []);
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const categoriesOf = useCallback(
    (type: ProductType) => Array.from(new Set((products ?? []).filter((p) => p.type === type).map((p) => p.category))),
    [products],
  );
  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        groups: categoriesOf(s.type).map((c) => ({ c, items: (products ?? []).filter((p) => p.type === s.type && p.category === c) })),
      })),
    [products, categoriesOf],
  );

  const newDraft = (type: ProductType) =>
    setDraft({ ...EMPTY, type, category: categoriesOf(type)[0] ?? (type === "entrada" ? "Entradas" : "") });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.category.trim() || !(draft.price >= 0)) return toast.error("Completa nombre, categoría y precio");
    try {
      await getApi().saveProduct({ ...draft, name: draft.name.trim(), category: draft.category.trim() });
      setDraft(null);
      toast.success(draft.type === "entrada" ? "Entrada guardada" : "Producto guardado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const toggle = async (p: Product) => {
    await getApi().saveProduct({ ...p, active: !p.active });
    load();
  };

  return (
    <div>
      <PageHeader title="Productos y entradas" subtitle="Lo inactivo no aparece al vender, pero se conserva en el historial." />

      {!products ? (
        <div className="py-14 grid place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.type}>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className={cx("h-8 w-8 rounded-lg grid place-items-center", s.type === "entrada" ? "bg-ink-pink/15 text-ink-pink" : "bg-surface-2 text-ink-2")}>
                    <s.icon size={17} />
                  </span>
                  <div>
                    <h2 className="font-semibold leading-tight">{s.title}</h2>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                </div>
                <Button size="sm" variant={s.type === "entrada" ? "primary" : "secondary"} onClick={() => newDraft(s.type)}>
                  <Plus size={15} /> {s.type === "entrada" ? "Nuevo tipo de entrada" : "Nuevo producto"}
                </Button>
              </div>

              {s.groups.length === 0 ? (
                <Card>
                  <Empty icon={s.type === "entrada" ? <Ticket size={26} /> : <Package size={26} />} title={s.type === "entrada" ? "Sin tipos de entrada" : "Sin productos"} />
                </Card>
              ) : (
                <div className="space-y-4">
                  {s.groups.map(({ c, items }) => (
                    <div key={c}>
                      {(s.groups.length > 1 || s.type === "consumo") && <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2">{c}</h3>}
                      <Card className="divide-y divide-line">
                        {items.map((p) => (
                          <div key={p.id} className={cx("flex items-center gap-4 px-4 py-3", !p.active && "opacity-50")}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{p.name}</p>
                              {(p.cost != null || (p.type === "entrada" && (p.free_until || p.max_per_night || p.presale_price != null || (p.people_per_unit ?? 1) > 1))) && (
                                <p className="mt-1 flex flex-wrap gap-1.5">
                                  {p.type === "entrada" && p.free_until && p.price > 0 && <Tag>Libre hasta {p.free_until}</Tag>}
                                  {p.type === "entrada" && (p.people_per_unit ?? 1) > 1 && <Tag>Incluye {p.people_per_unit} entradas</Tag>}
                                  {p.type === "entrada" && p.max_per_night && <Tag>Cupo {p.max_per_night} por noche</Tag>}
                                  {p.type === "entrada" && p.presale_price != null && <Tag>Preventa {bs(p.presale_price)}</Tag>}
                                  {p.cost != null && <span className="inline-flex rounded-md bg-surface-2 text-ink-2 px-1.5 py-0.5 text-[11px]">Costo {bs(p.cost)}</span>}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-mono tabular w-24 text-right">{p.price === 0 ? "Gratis" : bs(p.price)}</span>
                            <button
                              onClick={() => toggle(p)}
                              className={cx("relative h-5 w-9 rounded-full transition-colors shrink-0", p.active ? "bg-ok/70" : "bg-line")}
                              aria-label={p.active ? "Desactivar" : "Activar"}
                              title={p.active ? "Activo" : "Inactivo"}
                            >
                              <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all", p.active ? "left-[18px]" : "left-0.5")} />
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => setDraft({ ...p })} aria-label="Editar">
                              <Pencil size={15} />
                            </Button>
                          </div>
                        ))}
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar" : draft?.type === "entrada" ? "Nuevo tipo de entrada" : "Nuevo producto"}>
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div>
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {SECTIONS.map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: s.type, category: draft.type === s.type ? draft.category : categoriesOf(s.type)[0] ?? (s.type === "entrada" ? "Entradas" : "") })}
                    className={cx(
                      "h-11 rounded-lg border flex items-center justify-center gap-2 text-sm",
                      draft.type === s.type ? "border-foreground bg-foreground text-background" : "border-line text-ink-2 hover:text-ink",
                    )}
                  >
                    <s.icon size={16} />
                    {s.type === "entrada" ? "Entrada" : "Barra"}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <Label>Nombre</Label>
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={draft.type === "entrada" ? "Ej. Entrada VIP" : "Ej. Cerveza 620ml"} />
            </label>
            <label className="block">
              <Label>Categoría</Label>
              <Input list="cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={draft.type === "entrada" ? "Entradas" : "Ej. Cervezas"} />
              <datalist id="cats">
                {categoriesOf(draft.type).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            {draft.type === "entrada" ? (
              <EntrySetup draft={draft} setDraft={setDraft} />
            ) : (
              <label className="block">
                <Label>Precio (Bs)</Label>
                <Input type="number" inputMode="decimal" step="0.5" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="font-mono tabular" />
              </label>
            )}
            <label className="block">
              <Label>Costo por unidad (Bs, opcional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                placeholder="Sin costo registrado"
                value={draft.cost ?? ""}
                onChange={(e) => setDraft({ ...draft, cost: e.target.value === "" ? null : Number(e.target.value) })}
                className="font-mono tabular"
              />
              <span className="block text-xs text-muted-foreground mt-1">Se usa para calcular el costo y el margen en el cierre del día.</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-[var(--color-primary)]" />
              Activo (visible al vender)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md bg-secondary text-ink-2 px-1.5 py-0.5 text-[11px]">{children}</span>;
}

type FreeMode = "paid" | "until" | "free";

/** Price, free-entry rule and per-night limit for one entry type. */
function EntrySetup({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const mode: FreeMode = draft.price === 0 ? "free" : draft.free_until ? "until" : "paid";
  const setMode = (m: FreeMode) => {
    if (m === "free") setDraft({ ...draft, price: 0, free_until: null });
    else if (m === "until") setDraft({ ...draft, price: draft.price || 30, free_until: draft.free_until || "23:00" });
    else setDraft({ ...draft, price: draft.price || 30, free_until: null });
  };
  const options: { m: FreeMode; label: string; hint: string }[] = [
    { m: "paid", label: "Se cobra siempre", hint: "Toda la noche al mismo precio" },
    { m: "until", label: "Libre hasta una hora", hint: "Gratis al inicio, luego se cobra" },
    { m: "free", label: "Siempre libre", hint: "Solo se cuenta la persona" },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-line bg-surface-2/40 p-3.5">
      <div>
        <Label>Entrada libre</Label>
        <div className="grid gap-2">
          {options.map((o) => (
            <button
              key={o.m}
              type="button"
              onClick={() => setMode(o.m)}
              className={cx(
                "text-left rounded-lg border px-3 py-2 transition-colors",
                mode === o.m ? "border-foreground bg-secondary" : "border-line hover:border-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2 text-sm">
                <span className={cx("h-3.5 w-3.5 rounded-full border-2 shrink-0", mode === o.m ? "border-foreground bg-foreground" : "border-muted-foreground")} />
                {o.label}
              </span>
              <span className="block pl-5.5 text-xs text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className={cx("block", mode === "free" && "opacity-40")}>
          <Label>Precio (Bs)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            disabled={mode === "free"}
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            className="font-mono tabular"
          />
        </label>
        <label className={cx("block", mode !== "until" && "opacity-40")}>
          <Label>Libre hasta</Label>
          <Input type="time" disabled={mode !== "until"} value={draft.free_until ?? ""} onChange={(e) => setDraft({ ...draft, free_until: e.target.value || null })} />
        </label>
      </div>

      <label className="block">
        <Label>Precio de preventa (Bs, opcional)</Label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder="Igual al precio normal"
          value={draft.presale_price ?? ""}
          onChange={(e) => setDraft({ ...draft, presale_price: e.target.value === "" ? null : Number(e.target.value) })}
          className="font-mono tabular"
        />
        <span className="block text-xs text-muted-foreground mt-1">Se cobra al vender en preventa para una noche futura.</span>
      </label>

      <label className="block">
        <Label>Entradas incluidas</Label>
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={draft.people_per_unit ?? 1}
          onChange={(e) => setDraft({ ...draft, people_per_unit: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          className="font-mono tabular"
        />
        <span className="block text-xs text-muted-foreground mt-1">Personas que entran con cada unidad: 1 para una entrada individual, por ejemplo 12 para una mesa VIP.</span>
      </label>

      <label className="block">
        <Label>Cupo por noche</Label>
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          placeholder="Sin límite"
          value={draft.max_per_night ?? ""}
          onChange={(e) => setDraft({ ...draft, max_per_night: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })}
          className="font-mono tabular"
        />
        <span className="block text-xs text-muted-foreground mt-1">Al llegar al cupo, ya no se puede vender esta entrada esa noche.</span>
      </label>
    </div>
  );
}
