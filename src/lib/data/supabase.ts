import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DataApi } from "./api";
import type { Payment, Profile, Sale, SaleItem } from "../types";
import { businessDay } from "../format";

const BUCKET = "payment-proofs";

type SaleRow = Omit<Sale, "items" | "payments" | "created_by_name" | "voided_by_name"> & {
  sale_items: SaleItem[];
  payments: Payment[];
};

const SALE_SELECT =
  "id, created_at, business_day, created_by, table_label, note, total, status, void_reason, voided_by, voided_at, " +
  "sale_items(id, product_id, name, qty, unit_price, subtotal), " +
  "payments(id, sale_id, method, amount, reference, proof_path, proof_hash, status, reject_reason, verified_by, verified_at, created_at)";

const num = (v: unknown) => Number(v ?? 0);

/** names: profile id → full name (RLS: admins see everyone, staff only themselves). */
function toSale(r: SaleRow, names: Map<string, string>): Sale {
  const name = (id: string | null) => (id ? names.get(id) : undefined);
  return {
    id: r.id,
    created_at: r.created_at,
    business_day: r.business_day,
    created_by: r.created_by,
    created_by_name: name(r.created_by),
    table_label: r.table_label,
    note: r.note,
    total: num(r.total),
    status: r.status,
    void_reason: r.void_reason,
    voided_by: r.voided_by,
    voided_by_name: name(r.voided_by),
    voided_at: r.voided_at,
    items: (r.sale_items ?? []).map((i) => ({ ...i, unit_price: num(i.unit_price), subtotal: num(i.subtotal) })),
    payments: (r.payments ?? []).map((p) => ({ ...p, amount: num(p.amount), verified_by_name: name(p.verified_by) })),
  };
}

export function createSupabaseApi(url: string, anonKey: string): DataApi {
  const sb: SupabaseClient = createClient(url, anonKey);

  const uid = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Sesión expirada");
    return data.user.id;
  };
  const check = <T>(res: { data: T; error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  const profileNames = async () => {
    const { data } = await sb.from("profiles").select("id, full_name");
    return new Map((data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  };

  return {
    mode: "supabase",

    async getCurrentProfile() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (!p) return null;
      return { ...(p as Profile), email: data.user.email };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async listProducts(includeInactive = false) {
      let q = sb.from("products").select("*").order("category").order("name");
      if (!includeInactive) q = q.eq("active", true);
      const rows = check(await q) as { price: unknown }[];
      return rows.map((r) => ({ ...(r as object), price: num(r.price) })) as never;
    },
    async saveProduct(p) {
      const { id, ...rest } = p;
      if (id) check(await sb.from("products").update(rest).eq("id", id));
      else check(await sb.from("products").insert(rest));
    },

    async checkDuplicate(reference, hash) {
      const rows = check(await sb.rpc("check_duplicate", { p_reference: reference ?? "", p_hash: hash ?? "" }));
      return ((rows as never[]) ?? []).map((r: { amount: unknown }) => ({ ...(r as object), amount: num(r.amount) })) as never;
    },

    async createSale(input) {
      let proof_path: string | null = null;
      if (input.payment.proof) {
        const day = businessDay().replaceAll("-", "/");
        proof_path = `${day}/${crypto.randomUUID()}.jpg`;
        check(await sb.storage.from(BUCKET).upload(proof_path, input.payment.proof.file, { contentType: "image/jpeg" }));
      }
      const id = check(
        await sb.rpc("create_sale", {
          payload: {
            table_label: input.table_label ?? "",
            note: input.note ?? "",
            items: input.items,
            payment: {
              method: input.payment.method,
              amount: input.payment.amount,
              reference: input.payment.reference ?? "",
              proof_path,
              proof_hash: input.payment.proof?.hash ?? "",
            },
          },
        }),
      );
      return id as string;
    },

    async listSales(f) {
      let q = sb.from("sales").select(SALE_SELECT).gte("business_day", f.from).lte("business_day", f.to);
      if (f.staff) q = q.eq("created_by", f.staff);
      const [res, names] = await Promise.all([q.order("created_at", { ascending: false }), profileNames()]);
      const rows = check(res) as unknown as SaleRow[];
      let sales = rows.map((r) => toSale(r, names));
      if (f.method) sales = sales.filter((s) => s.payments.some((p) => p.method === f.method));
      if (f.status) sales = sales.filter((s) => s.payments.some((p) => p.status === f.status));
      return sales;
    },
    async listPending() {
      const [res, names] = await Promise.all([
        sb.from("sales").select(SALE_SELECT.replace("payments(", "payments!inner(")).eq("payments.status", "pending").neq("status", "void").order("created_at", { ascending: false }),
        profileNames(),
      ]);
      return (check(res) as unknown as SaleRow[]).map((r) => toSale(r, names));
    },
    async setPaymentStatus(paymentId, status, reason) {
      const me = await uid();
      check(
        await sb
          .from("payments")
          .update({ status, reject_reason: status === "rejected" ? reason ?? "" : null, verified_by: me, verified_at: new Date().toISOString() })
          .eq("id", paymentId),
      );
    },
    async voidSale(saleId, reason) {
      const me = await uid();
      check(await sb.from("sales").update({ status: "void", void_reason: reason, voided_by: me, voided_at: new Date().toISOString() }).eq("id", saleId));
    },
    async proofUrl(path) {
      const data = check(await sb.storage.from(BUCKET).createSignedUrl(path, 300));
      if (!data) throw new Error("No se pudo obtener la imagen");
      return data.signedUrl;
    },

    async listProfiles() {
      return check(await sb.from("profiles").select("*").order("full_name")) as Profile[];
    },
    async updateProfile(id, patch) {
      check(await sb.from("profiles").update(patch).eq("id", id));
    },
  };
}
