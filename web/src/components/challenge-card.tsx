import { Gift, Target, Trophy, Users } from "lucide-react";
import { METRICS, formatScore, isMetric } from "@/lib/challenges";

// The face of a challenge card. Built like a premium pass: a lime light runs
// round its edge, a giant line icon is watermarked into the dark, the days
// left are the headline number, a bar shows how much of the month has gone,
// and the goal, prize and players sit on a glass strip. Used in the swipe
// deck, the member's list and the staff preview. No hooks: server or client.
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
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

export function ChallengeCardFace({ challenge: c, preview = false }: { challenge: CardFaceData; preview?: boolean }) {
  const m = isMetric(c.metric) ? METRICS[c.metric] : null;
  const Icon = m?.icon ?? Trophy;
  const total = Math.max(1, daysBetween(c.starts_on, c.ends_on));
  // How much of the challenge has gone, from the days left (no clock reads, so
  // the server and the phone agree).
  const gone = c.state === "upcoming" ? 0 : c.state === "ended" ? 1 : Math.min(1, Math.max(0, (total - c.days_left) / total));
  const stats = [
    c.target ? { icon: Target, label: "Goal", value: formatScore(c.metric, c.target) } : null,
    c.prize ? { icon: Gift, label: "Prize", value: c.prize } : null,
    { icon: Users, label: "Players", value: c.participants ? String(c.participants) : "Be first" },
  ].filter((s) => s !== null);

  return (
    <div className={`challenge-face challenge-frame @container relative h-full rounded-[1.75rem] p-[1.5px] shadow-2xl shadow-ink/30 ${preview ? "" : "select-none"}`}>
      <div className="challenge-inner relative flex h-full min-h-[26rem] flex-col overflow-hidden rounded-[calc(1.75rem-1.5px)] p-6 text-white">
        <span aria-hidden className="challenge-grid" />
        <span aria-hidden className="challenge-glow" />
        <Icon aria-hidden className="challenge-mark" strokeWidth={1.1} />
        <span aria-hidden className="challenge-sheen" />

        {/* Status and the countdown */}
        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.07] py-1 pr-3 pl-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/10 backdrop-blur">
            <span className={`challenge-live size-1.5 rounded-full ${c.state === "active" ? "bg-brand" : c.state === "upcoming" ? "bg-amber-400" : "bg-white/40"}`} />
            {c.state === "upcoming" ? "Starts soon" : c.state === "ended" ? "Finished" : <>Live<span className="-ml-1 hidden @[19rem]:inline">challenge</span></>}
          </span>
          <span className="text-right leading-none">
            {c.state === "active" ? (
              <>
                <span className="block text-[2.6rem] font-black tabular-nums tracking-tighter text-brand">{c.days_left}</span>
                <span className="mt-1 block whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{c.days_left === 1 ? "day left" : "days left"}</span>
              </>
            ) : (
              <span className="block whitespace-nowrap pt-1 text-xs font-semibold text-white/60">
                {short(c.starts_on)} – {short(c.ends_on)}
              </span>
            )}
          </span>
        </div>

        {/* What it is */}
        <div className="relative mt-auto pt-8">
          <span className="inline-flex items-center gap-2.5">
            <span className="challenge-badge grid size-10 place-items-center rounded-xl bg-brand text-ink">
              <Icon className="size-5" strokeWidth={2.4} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">{m?.label ?? "Challenge"}</span>
          </span>
          <h3 className="mt-4 text-[1.85rem] font-black leading-[1.05] tracking-tight text-balance">{c.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">{c.description || (m ? `${m.verb}. ${m.hint}.` : "")}</p>
        </div>

        {/* How much of the month has gone */}
        <div className="relative mt-5">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="challenge-time h-full rounded-full bg-gradient-to-r from-brand/60 to-brand" style={{ width: `${Math.max(gone * 100, 3)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-white/40">
            <span>{short(c.starts_on)}</span>
            <span>{short(c.ends_on)}</span>
          </div>
        </div>

        {/* Goal, prize, players */}
        {/* Side by side on a full card; one per line on a narrow one. */}
        <dl
          className={`relative mt-4 grid divide-y divide-white/10 rounded-2xl bg-white/[0.06] px-3 ring-1 ring-white/10 backdrop-blur-md @[20rem]:divide-x @[20rem]:divide-y-0 @[20rem]:px-0 @[20rem]:py-3 ${
            ["", "@[20rem]:grid-cols-1", "@[20rem]:grid-cols-2", "@[20rem]:grid-cols-3"][stats.length]
          }`}
        >
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 items-center justify-between gap-3 py-2 @[20rem]:block @[20rem]:px-3 @[20rem]:py-0">
              <dt className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                <s.icon className="size-3" /> {s.label}
              </dt>
              <dd className="truncate text-sm font-semibold @[20rem]:mt-1">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
