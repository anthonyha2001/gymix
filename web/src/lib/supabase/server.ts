import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./config";
import type { Database } from "./database.types";

// Per-request client that reads/writes the auth session cookies.
export async function createClient() {
  // supabase-js reads the clock (session expiry), which Next forbids during
  // prerendering; this defers everything after it to request time.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    ...(process.env.GYMIX_TRACE_QUERIES ? { global: { fetch: tracedFetch } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

// Set GYMIX_TRACE_QUERIES=1 to log every database call with its duration
// (for finding slow pages). Off in normal use.
const tracedFetch: typeof fetch = async (input, init) => {
  const started = performance.now();
  const response = await fetch(input, init);
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  console.log(`[db] ${Math.round(performance.now() - started)}ms ${init?.method ?? "GET"} ${url.pathname}${url.search.slice(0, 80)}`);
  return response;
};
