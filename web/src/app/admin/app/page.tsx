import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AppView, type AppStats, type CrashRow, type ErrorGroup, type ErrorEvent } from "./view";

export const metadata: Metadata = { title: "App & errors" };

// The phone apps and everything that goes wrong: push, versions, crashes by
// platform, errors grouped, and each one's details.
export default function AppPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <App />
    </Suspense>
  );
}

async function App() {
  const supabase = await createClient();
  const [{ data: stats }, { data: crashes }, { data: monitoring }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_app_stats"),
    supabase.rpc("admin_crash_platforms", { p_days: 7 }),
    supabase.rpc("admin_monitoring", { p_days: 7 }),
    supabase.rpc("admin_recent_events", { p_kinds: ["error"], p_limit: 40 }),
  ]);
  const m = (monitoring ?? {}) as { error_groups?: ErrorGroup[]; series?: { day: string; errors: number }[] };
  return (
    <AppView
      stats={(stats ?? null) as AppStats | null}
      crashes={(crashes ?? []) as CrashRow[]}
      groups={m.error_groups ?? []}
      series={(m.series ?? []).map((s) => ({ x: s.day, y: Number(s.errors ?? 0) }))}
      recent={(recent ?? []) as ErrorEvent[]}
    />
  );
}
