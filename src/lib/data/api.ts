import type {
  DuplicateMatch,
  NewSaleInput,
  Product,
  Profile,
  Sale,
  SaleFilters,
} from "../types";

/** Everything the UI needs from the backend. Implemented by Supabase and by a local demo store. */
export interface DataApi {
  mode: "supabase" | "demo";

  // auth
  getCurrentProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  // products
  listProducts(includeInactive?: boolean): Promise<Product[]>;
  saveProduct(p: Omit<Product, "id"> & { id?: string }): Promise<void>;

  // sales & payments
  checkDuplicate(reference: string, hash: string): Promise<DuplicateMatch[]>;
  createSale(input: NewSaleInput): Promise<string>;
  listSales(filters: SaleFilters): Promise<Sale[]>;
  listPending(): Promise<Sale[]>;
  setPaymentStatus(paymentId: string, status: "verified" | "rejected", reason?: string): Promise<void>;
  voidSale(saleId: string, reason: string): Promise<void>;
  proofUrl(path: string): Promise<string>;

  // team
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Pick<Profile, "role" | "active" | "full_name">>): Promise<void>;
}
