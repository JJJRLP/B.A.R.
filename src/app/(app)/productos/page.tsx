"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Pencil, Plus } from "lucide-react";
import { getApi } from "@/lib/data";
import { bs } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Button, Card, Empty, Input, Label, Modal, PageHeader, Spinner, Toast, cx } from "@/components/ui";

type Draft = Omit<Product, "id"> & { id?: string };
const EMPTY: Draft = { name: "", category: "", price: 0, active: true };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "bad" } | null>(null);

  const load = useCallback(async () => {
    setProducts(await getApi().listProducts(true));
  }, []);
  useEffect(() => {
    load().catch((e) => setToast({ msg: e.message, kind: "bad" }));
  }, [load]);

  const categories = useMemo(() => Array.from(new Set((products ?? []).map((p) => p.category))), [products]);
  const grouped = useMemo(() => categories.map((c) => ({ c, items: (products ?? []).filter((p) => p.category === c) })), [categories, products]);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.category.trim() || !(draft.price >= 0)) return setToast({ msg: "Completa nombre, categoría y precio", kind: "bad" });
    try {
      await getApi().saveProduct({ ...draft, name: draft.name.trim(), category: draft.category.trim() });
      setDraft(null);
      setToast({ msg: "Producto guardado", kind: "ok" });
      load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Error", kind: "bad" });
    }
  };

  const toggle = async (p: Product) => {
    await getApi().saveProduct({ ...p, active: !p.active });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Los productos inactivos no aparecen al vender, pero se conservan en el historial."
        actions={
          <Button variant="primary" onClick={() => setDraft({ ...EMPTY, category: categories[0] ?? "" })}>
            <Plus size={16} /> Nuevo producto
          </Button>
        }
      />

      {!products ? (
        <div className="py-14 grid place-items-center">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <Empty icon={<Package size={28} />} title="Aún no hay productos" hint="Crea el primero para empezar a vender." />
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ c, items }) => (
            <section key={c}>
              <h2 className="text-xs uppercase tracking-wide text-muted mb-2">{c}</h2>
              <Card className="divide-y divide-line">
                {items.map((p) => (
                  <div key={p.id} className={cx("flex items-center gap-4 px-4 py-3", !p.active && "opacity-50")}>
                    <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                    <span className="text-sm tabular w-24 text-right">{bs(p.price)}</span>
                    <button
                      onClick={() => toggle(p)}
                      className={cx("relative h-5 w-9 rounded-full transition-colors shrink-0", p.active ? "bg-ok/70" : "bg-line")}
                      aria-label={p.active ? "Desactivar" : "Activar"}
                      title={p.active ? "Activo" : "Inactivo"}
                    >
                      <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all", p.active ? "left-4.5" : "left-0.5")} />
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ ...p })} aria-label="Editar">
                      <Pencil size={15} />
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar producto" : "Nuevo producto"}>
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="block">
              <Label>Nombre</Label>
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="block">
              <Label>Categoría</Label>
              <Input list="cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Ej. Cervezas" />
              <datalist id="cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <Label>Precio (Bs)</Label>
              <Input type="number" inputMode="decimal" step="0.5" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="tabular" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-[var(--color-accent)]" />
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

      {toast && <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  );
}
