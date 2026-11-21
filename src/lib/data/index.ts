import type { DataApi } from "./api";
import { createSupabaseApi } from "./supabase";
import { createDemoApi } from "./demo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let api: DataApi | null = null;

/** Supabase when env vars are set; otherwise a local demo store. */
export function getApi(): DataApi {
  if (!api) api = url && key ? createSupabaseApi(url, key) : createDemoApi();
  return api;
}

export type { DataApi };
