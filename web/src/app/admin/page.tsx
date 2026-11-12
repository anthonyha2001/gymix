import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoursAgoIso } from "@/lib/format";
import { LiveRoom, type Attention } from "./live-room";
import type { LiveData } from "./room-actions";

export const metadata: Metadata = { title: "Live" };

// The control room's front page: who's on the site right now, what they're
// doing, and what needs Gymix's attention.
export default function LivePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: live }, { data: health }, { count: requests }, { count: tickets }, { count: errors }] = await Promise.all([
    supabase.rpc("admin_live"),
    supabase.rpc("admin_gym_health"),
    admin.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("admin_unread", true).neq("status", "solved"),
    admin.from("platform_events").select("id", { count: "exact", head: true }).eq("kind", "error").gte("created_at", hoursAgoIso(24)),
  ]);
  const real = (health ?? []).filter((g) => !g.is_lab);
  const attention: Attention = {
    requests: requests ?? 0,
    tickets: tickets ?? 0,
    errors: errors ?? 0,
    atRisk: real.filter((g) => g.score < 40).sort((a, b) => a.score - b.score).slice(0, 5).map((g) => ({ id: g.gym_id, name: g.name, score: g.score })),
    gyms: real.length,
    paying: real.filter((g) => g.paid_until && new Date(g.paid_until) >= new Date(new Date().toDateString())).length,
    checkins7d: real.reduce((n, g) => n + g.checkins_7d, 0),
    checkinsPrev7d: real.reduce((n, g) => n + g.checkins_prev_7d, 0),
  };
  return <LiveRoom initial={(live ?? null) as LiveData | null} attention={attention} />;
}
