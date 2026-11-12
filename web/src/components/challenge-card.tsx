import { CalendarDays, Gift, Target, Users } from "lucide-react";
import { METRICS, formatScore, isMetric } from "@/lib/challenges";

// The face of a challenge card: dark, with the gym's lime, a big emoji and a
// light that sweeps across it. Used in the swipe deck, the member's list and
// the staff preview. No hooks: renders on the server or the client.
export type CardFaceData = {
  title: string;
  metric: string;
  description: string | null;
  prize: string | null;
  target: number | null;
  starts_on: string;
  ends_on: string;
  state: "upcoming" | "active" | "ended";
  days_left: number;
  participants: number;
};

const short = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function ChallengeCardFace({ challenge: c, preview = false }: { challenge: CardFaceData; preview?: boolean }) {
  const m = isMetric(c.metric) ? METRICS[c.metric] : null;
  return (
    <div className={`challenge-face relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-[1.75rem] bg-ink p-6 text-white shadow-2xl ${preview ? "" : "select-none"}`}>
      <span aria-hidden className="challenge-glow" />
      <span aria-hidden className="challenge-sheen" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
          {c.state === "upcoming" ? "Starts soon" : c.state === "ended" ? "Ended" : "Monthly challenge"}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/70">
          <CalendarDays className="size-3.5" />
          {c.state === "active" ? `${c.days_left} day${c.days_left === 1 ? "" : "s"} left` : `${short(c.starts_on)} – ${short(c.ends_on)}`}
        </span>
      </div>

      <div className="relative mt-8 flex-1">
        <span aria-hidden className="challenge-emoji block text-6xl leading-none">
          {m?.emoji ?? "🏆"}
        </span>
        <h3 className="mt-5 text-[1.7rem] font-bold leading-tight tracking-tight">{c.title}</h3>
        <p className="mt-2 text-sm text-white/70">{c.description || (m ? `${m.verb}. ${m.hint}.` : "")}</p>
      </div>

      <div className="relative mt-6 space-y-2">
        {c.target ? (
          <p className="flex items-center gap-2 text-sm">
            <Target className="size-4 text-brand" /> Goal: <b>{formatScore(c.metric, c.target)}</b>
          </p>
        ) : null}
        {c.prize ? (
          <p className="flex items-center gap-2 text-sm">
            <Gift className="size-4 text-brand" /> <span className="truncate">{c.prize}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-xs text-white/60">
          <Users className="size-3.5" />
          {c.participants ? `${c.participants} joined` : "Be the first to join"}
        </p>
      </div>
    </div>
  );
}
