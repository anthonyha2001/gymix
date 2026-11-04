import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";
import type { Database } from "./database.types";

// Service-role client: bypasses RLS. Server-only, and only for the few flows
// that must act before anyone is signed in (e.g. invite links).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
