import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { METRICS, formatScore, isMetric, type MemberChallenge } from "@/lib/challenges";

// On the member's home: a new challenge to swipe, or how they're doing in the
// one they joined. Nothing when there's no running challenge.
export async function ChallengeTeaser({ gymId }: { gymId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_challenges", { p_gym_id: gymId });
  const list = ((data ?? []) as unknown as MemberChallenge[]).filter((c) => c.state === "active");
  const fresh = list.filter((c) => c.status === null);
  const mine = list.find((c) => c.status === "joined");
  if (!fresh.length && !mine) return null;

  if (fresh.length) {
    const c = fresh[0];
    const m = isMetric(c.metric) ? METRICS[c.metric] : null;
    return (
      <Link href="/portal/challenges" className="challenge-face group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-ink p-5 text-white shadow-lg">
        <span aria-hidden className="challenge-glow" />
        <span aria-hidden className="challenge-sheen" />
        <span aria-hidden className="challenge-emoji relative text-4xl">{m?.emoji ?? "🏆"}</span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-brand">
            {fresh.length > 1 ? `${fresh.length} new challenges` : "New challenge"}
          </span>
          <span className="block truncate text-lg font-bold">{c.title}</span>
          <span className="block text-xs text-white/70">
            {c.participants ? `${c.participants} joined · ` : ""}
            {c.days_left} days left · swipe to join
          </span>
        </span>
        <ChevronRight className="relative size-5 shrink-0 text-brand transition-transform group-hover:translate-x-1" />
      </Link>
    );
  }

  const c = mine!;
  return (
    <Link href="/portal/challenges" className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-black text-ink">{c.rank ? `#${c.rank}` : "–"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.title}</span>
        <span className="block text-sm text-muted">
          {formatScore(c.metric, c.score)}
          {c.target ? ` of ${formatScore(c.metric, c.target)}` : ""} · {c.days_left} days left
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
