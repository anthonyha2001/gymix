import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { hoursAgoIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MarketingView, type Account, type DailyRow, type PostRow, type SocialPayoff } from "./view";

export const metadata: Metadata = { title: "Marketing" };

const SOCIAL = { instagram: /instagram|^ig$/i, facebook: /facebook|fb\.|^fb$|^meta/i, tiktok: /tiktok/i };

// Gymix's own Instagram, Facebook and TikTok: posts, reach, audience, and
// what each network brings to the website and to sign-ups.
export default function MarketingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[44rem] bg-white/5" />}>
      <Marketing />
    </Suspense>
  );
}

async function Marketing() {
  const supabase = await createClient();
  const since = hoursAgoIso(24 * 90);
  const [{ data: accounts }, { data: posts }, { data: daily }, { data: visitors }, { data: requests }] = await Promise.all([
    supabase.from("social_accounts").select("id, platform, handle, external_id, followers, following, posts_count, audience, connected, last_synced_at, sync_error").order("platform"),
    supabase.from("social_posts").select("*").gte("posted_at", since).order("posted_at", { ascending: false }).limit(500),
    supabase.from("social_daily").select("*").gte("day", since.slice(0, 10)).order("day"),
    supabase.rpc("admin_visitors", { p_days: 30 }),
    supabase.from("access_requests").select("source, status, created_at").gte("created_at", hoursAgoIso(24 * 30)),
  ]);

  // What each network brought in the last 30 days.
  const v = (visitors ?? {}) as { sources?: { source: string; n: number; visitors: number }[] };
  const payoff: SocialPayoff = (["instagram", "facebook", "tiktok"] as const).map((p) => {
    const re = SOCIAL[p];
    const src = (v.sources ?? []).filter((s) => re.test(s.source));
    const reqs = (requests ?? []).filter((r) => r.source && re.test(r.source));
    return {
      platform: p,
      visits: src.reduce((n, s) => n + Number(s.n), 0),
      visitors: src.reduce((n, s) => n + Number(s.visitors), 0),
      requests: reqs.length,
      paid: reqs.filter((r) => r.status === "paid").length,
    };
  });

  return <MarketingView accounts={(accounts ?? []) as Account[]} posts={(posts ?? []) as PostRow[]} daily={(daily ?? []) as DailyRow[]} payoff={payoff} />;
}
