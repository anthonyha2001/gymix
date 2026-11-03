import { isUnreachable, UNREACHABLE_MESSAGE } from "@/lib/supabase/config";

export type ActionState = { error?: string; success?: string };

type DbError = { code?: string; message: string; status?: number; name?: string };

// Turns a Supabase/Postgres error into something a gym owner can read.
// Our database functions raise plain-English messages for validation (22023)
// and not-found (P0002), so those are shown as-is.
export function errorMessage(error: DbError, fallback = "Something went wrong. Please try again.") {
  if (isUnreachable(error)) return UNREACHABLE_MESSAGE;
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "22023" || error.code === "P0002") return error.message;
  if (error.code === "23505") return "That already exists.";
  return fallback;
}

export function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function money(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/[,\s$]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
