"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Trophy } from "lucide-react";
import { ChallengeDeck } from "@/components/challenge-deck";
import { CountUp } from "@/components/count-up";
import { Modal } from "@/components/dialog";
import { METRICS, MEDALS, formatScore, isMetric, type MemberChallenge } from "@/lib/challenges";
import { loadBoard, setChallengeEntry, type BoardRow } from "./actions";

// The member's challenges: new ones to swipe, the ones they're in (with a
// progress ring and their rank), and recent results with medals.
export function ChallengesView({ challenges }: { challenges: MemberChallenge[] }) {
  const [open, setOpen] = useState<MemberChallenge | null>(null);
  const fresh = challenges.filter((c) => c.state !== "ended" && c.status === null);
  const mine = challenges.filter((c) => c.state !== "ended" && c.status === "joined");
  const skipped = challenges.filter((c) => c.state !== "ended" && c.status === "skipped");
  const ended = challenges.filter((c) => c.state === "ended" && c.status === "joined");

  return (
    <div className="space-y-8">
      {fresh.length ? (
        <ChallengeDeck cards={fresh} onDecide={setChallengeEntry} />
      ) : !mine.length ? (
        <div className="page-enter rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Trophy className="mx-auto size-10 text-muted" />
          <p className="mt-3 font-semibold">No challenges right now</p>
          <p className="mt-1 text-sm text-muted">When your gym posts one, it shows up here and you get a notification.</p>
        </div>
      ) : null}

      {mine.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">You&apos;re in</h2>
          <ul className="stagger space-y-3">
            {mine.map((c) => (
              <li key={c.id}>
                <ChallengeRow challenge={c} onOpen={() => setOpen(c)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ended.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Results</h2>
          <ul className="stagger space-y-3">
            {ended.map((c) => (
              <li key={c.id}>
                <ChallengeRow challenge={c} onOpen={() => setOpen(c)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skipped.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Skipped</h2>
          <ul className="space-y-2">
            {skipped.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="text-xs text-muted">{c.participants} joined</span>
                </span>
                <JoinLater id={c.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.title ?? ""} sheet>
        {open && <Board challenge={open} />}
      </Modal>
    </div>
  );
}

function JoinLater({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setChallengeEntry(id, true);
        setBusy(false);
      }}
      className="h-9 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-white disabled:opacity-60"
    >
      {busy ? "Joining…" : "Join"}
    </button>
  );
}

// A progress ring that fills from empty when it appears.
function Ring({ value, max, children }: { value: number; max: number; children: React.ReactNode }) {
  const r = 26;
  const length = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(Math.min(1, max ? value / max : 0)));
    return () => cancelAnimationFrame(t);
  }, [value, max]);
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-line" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--color-brand-strong)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - shown)}
          className="ring-fill"
        />
      </svg>
      <span className="relative text-center leading-none">{children}</span>
    </span>
  );
}

function ChallengeRow({ challenge: c, onOpen }: { challenge: MemberChallenge; onOpen: () => void }) {
  const m = isMetric(c.metric) ? METRICS[c.metric] : null;
  const score = Number(c.score ?? 0);
  // Without a goal, the ring shows how close the member is to first place.
  const leader = Number(c.top[0]?.score ?? 0);
  const max = c.target ? Number(c.target) : Math.max(leader, score, 1);
  const medal = c.state === "ended" && c.rank && c.rank <= 3 ? MEDALS[c.rank - 1] : null;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left shadow-sm transition hover:border-ink/20">
      <Ring value={score} max={max}>
        {medal ? (
          <span className="medal-pop text-2xl">{medal}</span>
        ) : (
          <>
            <span className="block text-sm font-bold">#{c.rank ? <CountUp value={String(c.rank)} /> : "–"}</span>
            <span className="text-[10px] text-muted">of {c.participants}</span>
          </>
        )}
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span aria-hidden>{m?.emoji}</span>
          <span className="truncate font-semibold">{c.title}</span>
        </span>
        <span className="mt-0.5 block text-sm">
          <b>{formatScore(c.metric, score)}</b>
          {c.target ? <span className="text-muted"> of {formatScore(c.metric, c.target)}</span> : null}
          {c.completed ? <span className="ml-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Goal reached</span> : null}
        </span>
        <span className="block text-xs text-muted">
          {c.state === "ended" ? (c.rank ? `Finished #${c.rank} of ${c.participants}` : "Ended") : `${c.days_left} day${c.days_left === 1 ? "" : "s"} left`}
          {c.prize ? ` · 🎁 ${c.prize}` : ""}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" />
    </button>
  );
}

function Board({ challenge: c }: { challenge: MemberChallenge }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadBoard(c.id).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [c.id]);

  if (!rows) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    );
  }
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">Nobody has joined yet.</p>;
  return (
    <ol className="stagger space-y-1.5 pb-2">
      {rows.map((r, i) => (
        <li
          key={`${r.rank}-${r.name}-${i}`}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.is_me ? "board-me bg-brand/15" : i < 3 ? "bg-canvas" : ""}`}
        >
          <span className="w-8 text-center text-lg font-bold tabular-nums">{r.rank <= 3 ? <span className="medal-pop" style={{ animationDelay: `${i * 90}ms` }}>{MEDALS[r.rank - 1]}</span> : r.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {r.name}
            {r.is_me ? <span className="ml-1.5 text-xs text-muted">(you)</span> : null}
          </span>
          {r.completed ? <span className="text-xs font-semibold text-success">✓ Goal</span> : null}
          <span className="text-sm font-semibold tabular-nums">{formatScore(c.metric, r.score)}</span>
        </li>
      ))}
    </ol>
  );
}
