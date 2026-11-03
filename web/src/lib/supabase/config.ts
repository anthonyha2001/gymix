export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function supabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

// supabase-js reports "couldn't reach the server" as a normal error with status 0,
// not as a thrown exception, so callers must check for it explicitly.
export function isUnreachable(error: { status?: number; name?: string } | null) {
  return Boolean(error && (error.status === 0 || error.name === "AuthRetryableFetchError"));
}

export const UNREACHABLE_MESSAGE =
  "Couldn't reach the Gymix server. Check your connection and try again.";
