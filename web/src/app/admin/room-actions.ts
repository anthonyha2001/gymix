"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/session";

// Small live reads for the control room's client parts (polled).

export async function liveNow() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_live");
  return (data ?? null) as LiveData | null;
}

export type LiveData = {
  now: { id: string; country: string | null; city: string | null; lat: number | null; lng: number | null; device: string | null; browser: string | null; platform: string | null; started_at: string; pageviews: number; path: string | null; source: string | null; signed_in: boolean; who: string | null }[];
  today: { sessions: number; visitors: number; pageviews: number; avg_active_s: number };
  last_hour: { minute: string; sessions: number }[];
  feed: { at: string; kind: string; what: string | null; country: string | null; city: string | null; device: string | null }[];
};
