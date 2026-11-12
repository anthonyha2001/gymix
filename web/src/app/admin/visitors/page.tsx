import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { VisitorsView, type VisitorsData, type SessionRow } from "./view";

export const metadata: Metadata = { title: "Visitors" };

const RANGES = [7, 30, 90] as const;

// Everything about the website's visitors: where from, what they read, for
// how long, what they clicked, and how many became gyms.
export default function VisitorsPage({ searchParams }: PageProps<"/admin/visitors">) {
  return (
    <Suspense fallback={<Skeleton className="h-[48rem] bg-white/5" />}>
      <Visitors searchParams={searchParams} />
    </Suspense>
  );
}

async function Visitors({ searchParams }: { searchParams: PageProps<"/admin/visitors">["searchParams"] }) {
  const q = await searchParams;
  const days = RANGES.find((r) => String(r) === q.range) ?? 30;
  const country = typeof q.country === "string" ? q.country : null;
  const source = typeof q.source === "string" ? q.source : null;
  const supabase = await createClient();
  const [{ data }, { data: sessions }] = await Promise.all([
    supabase.rpc("admin_visitors", { p_days: days }),
    supabase.rpc("admin_sessions", { p_limit: 60, p_country: country ?? undefined, p_source: source ?? undefined }),
  ]);
  return <VisitorsView days={days} data={(data ?? null) as VisitorsData | null} sessions={(sessions ?? []) as SessionRow[]} filter={{ country, source }} />;
}
