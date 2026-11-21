export type Role = "admin" | "staff";
export type PaymentMethod = "qr" | "cash" | "card";
export type PaymentStatus = "pending" | "verified" | "rejected";
export type SaleStatus = "open" | "paid" | "void";

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  role: Role;
  active: boolean;
}

/** entrada = entrance fee (General, VIP…), consumo = drinks/food at the bar */
export type ProductType = "entrada" | "consumo";

export const TYPE_LABEL: Record<ProductType, string> = {
  entrada: "Entradas",
  consumo: "Barra",
};

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  category: string;
  price: number;
  active: boolean;
  /** entries only: max sold per night (null = no limit) */
  max_per_night?: number | null;
  /** entries only: free before this La Paz time "HH:MM" (null = never free) */
  free_until?: string | null;
  /** entries only: people let in per unit (1 = single entry, 6 = table for 6) */
  people_per_unit?: number;
  /** cost per unit, for the margin in the daily review (null = not set) */
  cost?: number | null;
  /** entries only: presale price (null = same as the normal price) */
  presale_price?: number | null;
}

export interface SaleItem {
  id: string;
  product_id: string;
  name: string;
  product_type: ProductType;
  people_per_unit?: number;
  qty: number;
  unit_price: number;
  subtotal: number;
  unit_cost?: number | null;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  proof_path: string | null;
  proof_hash: string | null;
  status: PaymentStatus;
  reject_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verified_by_name?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  created_at: string;
  business_day: string;
  created_by: string;
  created_by_name?: string;
  table_label: string | null;
  note: string | null;
  total: number;
  status: SaleStatus;
  void_reason: string | null;
  voided_by: string | null;
  voided_by_name?: string;
  voided_at: string | null;
  /** buyer (titular), required when the sale includes entries */
  customer_name?: string | null;
  customer_ci?: string | null;
  guests?: Guest[];
  /** the night the entries are for (a presale is sold before it) */
  event_day?: string;
  is_presale?: boolean;
  /** código de relacionador */
  promoter_code?: string | null;
  items: SaleItem[];
  payments: Payment[];
}

export interface Guest {
  full_name: string;
  ci?: string | null;
}

export interface NewSaleInput {
  table_label?: string;
  note?: string;
  customer?: { name: string; ci: string };
  guests?: Guest[];
  promoter_code?: string;
  /** presale: the night the entries are for */
  presale?: { event_day: string } | null;
  items: { product_id: string; qty: number }[];
  payment: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    /** QR only: true = seller already confirmed it in the bank app */
    confirmed?: boolean;
    proof?: { file: Blob; hash: string } | null;
  };
}

export interface DuplicateMatch {
  payment_id: string;
  created_at: string;
  amount: number;
  match: "reference" | "image";
}

export interface SaleFilters {
  from: string; // business day yyyy-mm-dd
  to: string;
  method?: PaymentMethod | "";
  status?: PaymentStatus | "";
  staff?: string; // profile id
  search?: string; // buyer/guest name or CI
  /** filter by the sale day (default) or by the night the entries are for */
  by?: "business_day" | "event_day";
}

/** One entry sale found at the door by name or CI. */
export interface Reservation {
  sale_id: string;
  created_at: string;
  customer_name: string | null;
  customer_ci: string | null;
  entries: string;
  people: number;
  guests: Guest[];
  total: number;
  payment_status: PaymentStatus | null;
  sold_by: string | null;
  sale_status: SaleStatus;
  is_presale?: boolean;
  promoter_code?: string | null;
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  qr: "QR / Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  verified: "Verificado",
  rejected: "Rechazado",
};
