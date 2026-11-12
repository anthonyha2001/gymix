"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { ChallengeCardFace } from "@/components/challenge-card";
import { Confetti } from "@/components/confetti";
import { showToast } from "@/components/toaster";
import type { MemberChallenge } from "@/lib/challenges";
import { haptics } from "@/lib/haptics";

const THRESHOLD = 110; // px of drag that counts as a decision

type Fly = { id: string; dir: 1 | -1 } | null;

// Challenges the member hasn't decided on, as a stack of cards. Drag right to
// join, left to skip (or use the buttons, or the arrow keys). The card tilts
// with the finger, shows JOIN or SKIP, and flies off; joining bursts confetti.
export function ChallengeDeck({ cards, onDecide }: { cards: MemberChallenge[]; onDecide: (id: string, join: boolean) => Promise<string | null> }) {
  const [queue, setQueue] = useState(cards);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [fly, setFly] = useState<Fly>(null);
  const [burst, setBurst] = useState(0);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const crossed = useRef(false);
  const top = queue[0];

  function decide(join: boolean) {
    if (!top || fly) return;
    const card = top;
    setFly({ id: card.id, dir: join ? 1 : -1 });
    if (join) haptics.success();
    else haptics.tap();
    if (join) setBurst(Date.now());
    // The card flies off, then the next one moves up.
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setFly(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 320);
    onDecide(card.id, join).then((error) => {
      if (error) {
        showToast(error, "error");
        setQueue((q) => [card, ...q]);
      } else if (join) {
        showToast(`You're in: ${card.title}`);
      }
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!top) return null;

  const x = drag.x;
  const rot = x / 18;
  const progress = Math.min(1, Math.abs(x) / THRESHOLD);
  const style: React.CSSProperties = fly?.id === top.id
    ? { transform: `translate(${fly.dir * 140}vw, ${drag.y - 40}px) rotate(${fly.dir * 28}deg)`, transition: "transform 380ms cubic-bezier(0.4, 0, 0.6, 1)" }
    : {
        transform: `translate(${x}px, ${drag.y * 0.25}px) rotate(${rot}deg)`,
        transition: drag.active ? "none" : "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      };

  return (
    <section aria-label="New challenges" className="relative">
      <div className="relative mx-auto h-[28rem] max-w-sm">
        {/* The next cards wait underneath, slightly smaller. */}
        {queue.slice(1, 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${(i + 1) * 12 - (i === 0 ? progress * 12 : 0)}px) scale(${1 - (i + 1) * 0.05 + (i === 0 ? progress * 0.05 : 0)})`, zIndex: 2 - i }}
          >
            {/* Solid and dimmed (not see-through), so cards never show through each other. */}
            <div className="relative h-full overflow-hidden rounded-[1.75rem]">
              <ChallengeCardFace challenge={c} />
              <span className="absolute inset-0 rounded-[1.75rem] bg-ink/55" />
            </div>
          </div>
        ))}

        <div
          key={top.id}
          role="group"
          aria-roledescription="Challenge card"
          aria-label={`${top.title}. Swipe right to join, left to skip.`}
          className="deck-enter absolute inset-0 z-10 cursor-grab touch-pan-y active:cursor-grabbing"
          style={style}
          onPointerDown={(e) => {
            if (fly) return;
            start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
            crossed.current = false;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDrag({ x: 0, y: 0, active: true });
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const dx = e.clientX - start.current.x;
            const dy = e.clientY - start.current.y;
            // A small tick when the drag crosses the line, either way.
            const over = Math.abs(dx) > THRESHOLD;
            if (over !== crossed.current) {
              crossed.current = over;
              haptics.tick();
            }
            setDrag({ x: dx, y: dy, active: true });
          }}
          onPointerUp={(e) => {
            if (!start.current) return;
            const dx = e.clientX - start.current.x;
            const speed = Math.abs(dx) / Math.max(1, performance.now() - start.current.t);
            start.current = null;
            if (Math.abs(dx) > THRESHOLD || (speed > 0.6 && Math.abs(dx) > 40)) decide(dx > 0);
            else setDrag({ x: 0, y: 0, active: false });
          }}
          onPointerCancel={() => {
            start.current = null;
            setDrag({ x: 0, y: 0, active: false });
          }}
        >
          <ChallengeCardFace challenge={top} />
          {/* JOIN / SKIP stamps grow with the drag. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-8 left-6 rotate-[-14deg] rounded-xl border-4 border-brand px-3 py-1 text-2xl font-black tracking-widest text-brand"
            style={{ opacity: x > 0 ? progress : 0, transform: `rotate(-14deg) scale(${0.8 + progress * 0.25})` }}
          >
            JOIN
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute top-8 right-6 rounded-xl border-4 border-white/80 px-3 py-1 text-2xl font-black tracking-widest text-white/80"
            style={{ opacity: x < 0 ? progress : 0, transform: `rotate(14deg) scale(${0.8 + progress * 0.25})` }}
          >
            SKIP
          </span>
        </div>

        {burst ? (
          <span key={burst} className="pointer-events-none absolute inset-0 z-20">
            <Confetti pieces={28} />
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => decide(false)}
          aria-label={`Skip ${top.title}`}
          className="grid size-14 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:text-ink active:scale-90"
          style={{ transform: x < 0 ? `scale(${1 + progress * 0.15})` : undefined }}
        >
          <X className="size-6" />
        </button>
        <span className="text-xs text-muted">
          {queue.length} new challenge{queue.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => decide(true)}
          aria-label={`Join ${top.title}`}
          className="grid size-16 place-items-center rounded-full bg-brand text-ink shadow-lg shadow-brand/40 transition active:scale-90"
          style={{ transform: x > 0 ? `scale(${1 + progress * 0.15})` : undefined }}
        >
          <Check className="size-7" strokeWidth={3} />
        </button>
      </div>
    </section>
  );
}
