import type { DataApi } from "./api";
import type { Payment, Product, Profile, Sale } from "../types";
import { blobToDataUrl, compressImage } from "../image";
import { businessDay } from "../format";

/**
 * Demo backend: keeps everything in this browser's localStorage so the app can be
 * tried without a Supabase project. Not for production use.
 */

const KEY = "bar-demo-v1";
const SESSION = "bar-demo-session";

interface Store {
  profiles: Profile[];
  products: Product[];
  sales: Omit<Sale, "created_by_name" | "voided_by_name">[];
  proofs: Record<string, string>; // path -> data URL
}

const uuid = () => crypto.randomUUID();

const SEED_ENTRIES: [string, string, number][] = [
  ["Entrada General", "Entradas", 30],
  ["Entrada VIP", "Entradas", 80],
];

const SEED_PRODUCTS: [string, string, number][] = [
  ["Cerveza Paceña 620ml", "Cervezas", 25],
  ["Cerveza Huari 620ml", "Cervezas", 28],
  ["Cerveza artesanal", "Cervezas", 35],
  ["Chuflay", "Cócteles", 30],
  ["Mojito", "Cócteles", 35],
  ["Fernet con cola", "Cócteles", 30],
  ["Singani (vaso)", "Destilados", 20],
  ["Agua mineral", "Sin alcohol", 10],
  ["Gaseosa", "Sin alcohol", 12],
  ["Papas fritas", "Comida", 25],
  ["Hamburguesa", "Comida", 45],
  ["Tequeños", "Comida", 30],
];

function seed(): Store {
  return {
    profiles: [
      { id: "demo-admin", full_name: "Dueño (demo)", email: "admin@demo", role: "admin", active: true },
      { id: "demo-staff", full_name: "Barra (demo)", email: "barra@demo", role: "staff", active: true },
    ],
    products: [
      ...SEED_ENTRIES.map(([name, category, price]) => ({ id: uuid(), name, type: "entrada" as const, category, price, active: true })),
      ...SEED_PRODUCTS.map(([name, category, price]) => ({ id: uuid(), name, type: "consumo" as const, category, price, active: true })),
    ],
    sales: [],
    proofs: {},
  };
}

/** Upgrade demo data saved by older versions of the app. */
function migrate(s: Store): Store {
  let changed = false;
  for (const p of s.products)
    if (!p.type) {
      p.type = "consumo";
      changed = true;
    }
  for (const sale of s.sales)
    for (const i of sale.items)
      if (!i.product_type) {
        i.product_type = "consumo";
        changed = true;
      }
  if (!s.products.some((p) => p.type === "entrada")) {
    s.products.unshift(...SEED_ENTRIES.map(([name, category, price]) => ({ id: uuid(), name, type: "entrada" as const, category, price, active: true })));
    changed = true;
  }
  if (changed) save(s);
  return s;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as Store);
  } catch {}
  const s = seed();
  save(s);
  return s;
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new Error("Almacenamiento del navegador lleno (modo demo). Borra datos demo desde Equipo.");
  }
}

const listeners = new Set<() => void>();
const currentId = () => {
  try {
    return localStorage.getItem(SESSION);
  } catch {
    return null;
  }
};

export function resetDemo() {
  localStorage.removeItem(KEY);
}

export function createDemoApi(): DataApi {
  const me = () => {
    const s = load();
    const p = s.profiles.find((x) => x.id === currentId());
    if (!p) throw new Error("Sesión expirada");
    return p;
  };
  const withName = (s: Store, sale: Store["sales"][number]): Sale => {
    const name = (id: string | null) => (id ? s.profiles.find((p) => p.id === id)?.full_name : undefined);
    return {
      ...sale,
      voided_by: sale.voided_by ?? null,
      voided_at: sale.voided_at ?? null,
      created_by_name: name(sale.created_by),
      voided_by_name: name(sale.voided_by ?? null),
      payments: sale.payments.map((p) => ({ ...p, verified_by_name: name(p.verified_by) })),
    };
  };
  const visible = (s: Store) => {
    const user = me();
    const today = businessDay();
    return s.sales.filter((x) => user.role === "admin" || (x.created_by === user.id && x.business_day === today));
  };
  const requireAdmin = () => {
    if (me().role !== "admin") throw new Error("Solo un administrador puede hacer esto");
  };

  return {
    mode: "demo",

    async getCurrentProfile() {
      const id = currentId();
      if (!id) return null;
      return load().profiles.find((p) => p.id === id && p.active) ?? null;
    },
    async signIn(email) {
      const p = load().profiles.find((x) => x.email === email.trim().toLowerCase());
      if (!p) throw new Error("Usuario demo no encontrado");
      localStorage.setItem(SESSION, p.id);
      listeners.forEach((l) => l());
    },
    async signOut() {
      localStorage.removeItem(SESSION);
      listeners.forEach((l) => l());
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async listProducts(includeInactive = false) {
      return load()
        .products.filter((p) => includeInactive || p.active)
        .sort((a, b) => (a.type === b.type ? 0 : a.type === "entrada" ? -1 : 1) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    },
    async saveProduct(p) {
      requireAdmin();
      const s = load();
      if (p.id) s.products = s.products.map((x) => (x.id === p.id ? { ...x, ...p, id: x.id } : x));
      else s.products.push({ ...p, id: uuid() });
      save(s);
    },

    async checkDuplicate(reference, hash) {
      const ref = (reference ?? "").trim().toLowerCase();
      const out = [];
      for (const sale of load().sales)
        for (const p of sale.payments) {
          if (ref && p.reference?.toLowerCase() === ref) out.push({ payment_id: p.id, created_at: p.created_at, amount: p.amount, match: "reference" as const });
          else if (hash && p.proof_hash === hash) out.push({ payment_id: p.id, created_at: p.created_at, amount: p.amount, match: "image" as const });
        }
      return out.slice(0, 5);
    },

    async createSale(input) {
      const user = me();
      const s = load();
      if (!input.items.length) throw new Error("La venta no tiene productos");
      const now = new Date().toISOString();
      const saleId = uuid();
      const items = input.items.map((i) => {
        const prod = s.products.find((p) => p.id === i.product_id && p.active);
        if (!prod) throw new Error("Producto no encontrado");
        return { id: uuid(), product_id: prod.id, name: prod.name, product_type: prod.type, qty: i.qty, unit_price: prod.price, subtotal: prod.price * i.qty };
      });
      let proof_path: string | null = null;
      if (input.payment.proof) {
        // smaller than production so localStorage doesn't fill up
        const small = await compressImage(input.payment.proof.file, 700, 0.6);
        proof_path = `demo/${uuid()}.jpg`;
        s.proofs[proof_path] = await blobToDataUrl(small);
      }
      const isQr = input.payment.method === "qr";
      const payment: Payment = {
        id: uuid(),
        sale_id: saleId,
        method: input.payment.method,
        amount: input.payment.amount,
        reference: input.payment.reference?.trim() || null,
        proof_path,
        proof_hash: input.payment.proof?.hash ?? null,
        status: isQr ? "pending" : "verified",
        reject_reason: null,
        verified_by: isQr ? null : user.id,
        verified_at: isQr ? null : now,
        created_at: now,
      };
      s.sales.push({
        id: saleId,
        created_at: now,
        business_day: businessDay(now),
        created_by: user.id,
        table_label: input.table_label?.trim() || null,
        note: input.note?.trim() || null,
        total: items.reduce((a, i) => a + i.subtotal, 0),
        status: "paid",
        void_reason: null,
        voided_by: null,
        voided_at: null,
        items,
        payments: [payment],
      });
      save(s);
      return saleId;
    },

    async listSales(f) {
      const s = load();
      return visible(s)
        .filter((x) => x.business_day >= f.from && x.business_day <= f.to)
        .filter((x) => !f.staff || x.created_by === f.staff)
        .filter((x) => !f.method || x.payments.some((p) => p.method === f.method))
        .filter((x) => !f.status || x.payments.some((p) => p.status === f.status))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((x) => withName(s, x));
    },
    async listPending() {
      const s = load();
      return visible(s)
        .filter((x) => x.status !== "void" && x.payments.some((p) => p.status === "pending"))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((x) => withName(s, { ...x, payments: x.payments.filter((p) => p.status === "pending") }));
    },
    async setPaymentStatus(paymentId, status, reason) {
      requireAdmin();
      const user = me();
      const s = load();
      for (const sale of s.sales)
        for (const p of sale.payments)
          if (p.id === paymentId) {
            p.status = status;
            p.reject_reason = status === "rejected" ? reason ?? "" : null;
            p.verified_by = user.id;
            p.verified_at = new Date().toISOString();
          }
      save(s);
    },
    async voidSale(saleId, reason) {
      requireAdmin();
      const s = load();
      const sale = s.sales.find((x) => x.id === saleId);
      if (sale) {
        sale.status = "void";
        sale.void_reason = reason;
        sale.voided_by = me().id;
        sale.voided_at = new Date().toISOString();
      }
      save(s);
    },
    async proofUrl(path) {
      return load().proofs[path] ?? "";
    },

    async listProfiles() {
      requireAdmin();
      return load().profiles;
    },
    async updateProfile(id, patch) {
      requireAdmin();
      const s = load();
      s.profiles = s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
      save(s);
    },
  };
}
