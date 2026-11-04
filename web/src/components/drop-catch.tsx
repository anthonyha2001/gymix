"use client";

import { useEffect, useRef, useState } from "react";

// Dropped the phone? MotionGestures spots the fall and the hit and sends
// "gymix:drop" (so does Profile's "Try it"). The screen "cracks", then heals
// with a joke.
const LINES = [
  "Gravity 1, you 0.",
  "That's not a deadlift.",
  "The floor wanted a rep too.",
  "Butterfingers. Chalk up.",
  "Screen's fine. Your form?",
];

type Crack = { d: string; delay: number };

// Jagged rays and a broken ring around the impact point, in a 100x100 box.
function makeCracks(cx: number, cy: number): Crack[] {
  const cracks: Crack[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    let x = cx;
    let y = cy;
    let d = `M${x} ${y}`;
    const steps = 4 + Math.floor(Math.random() * 3);
    for (let s = 0; s < steps; s++) {
      const len = 7 + Math.random() * 14;
      const turn = a + (Math.random() - 0.5) * 0.7;
      x += Math.cos(turn) * len;
      y += Math.sin(turn) * len;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    cracks.push({ d, delay: Math.random() * 90 });
  }
  for (const r of [6, 13]) {
    let d = "";
    for (let i = 0; i < 14; i++) {
      if (Math.random() < 0.3) continue;
      const a1 = (i / 14) * Math.PI * 2;
      const a2 = ((i + 1) / 14) * Math.PI * 2;
      const j = () => r + (Math.random() - 0.5) * 2.5;
      d += ` M${(cx + Math.cos(a1) * j()).toFixed(1)} ${(cy + Math.sin(a1) * j()).toFixed(1)} L${(cx + Math.cos(a2) * j()).toFixed(1)} ${(cy + Math.sin(a2) * j()).toFixed(1)}`;
    }
    if (d) cracks.push({ d, delay: 120 });
  }
  return cracks;
}

export function DropCatch() {
  const [drop, setDrop] = useState<{ id: number; cracks: Crack[]; cx: number; cy: number; line: string } | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const play = () => {
      const now = Date.now();
      if (now - last.current < 4000) return;
      last.current = now;
      const cx = 30 + Math.random() * 40;
      const cy = 35 + Math.random() * 30;
      navigator.vibrate?.([70, 40, 120]);
      setDrop({ id: now, cracks: makeCracks(cx, cy), cx, cy, line: LINES[Math.floor(Math.random() * LINES.length)] });
    };
    window.addEventListener("gymix:drop", play);
    return () => window.removeEventListener("gymix:drop", play);
  }, []);

  useEffect(() => {
    if (!drop) return;
    const t = setTimeout(() => setDrop(null), 4200);
    return () => clearTimeout(t);
  }, [drop]);

  if (!drop) return null;
  return (
    <div key={drop.id} className="drop-scene fixed inset-0 z-[70] cursor-pointer" onClick={() => setDrop(null)} role="status" aria-live="assertive">
      <div className="drop-flash absolute inset-0 bg-white" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="drop-glass absolute inset-0 size-full" aria-hidden>
        <circle cx={drop.cx} cy={drop.cy} r="1.6" className="fill-white/80" />
        {drop.cracks.map((c, i) => (
          <path key={i} d={c.d} pathLength={1} vectorEffect="non-scaling-stroke" className="drop-crack" style={{ animationDelay: `${c.delay}ms` }} />
        ))}
      </svg>
      <div className="absolute inset-x-6 bottom-[calc(var(--bottom-bar)+2rem)] grid place-items-center">
        <div className="drop-card max-w-sm rounded-3xl bg-ink px-6 py-5 text-center text-white shadow-2xl">
          <p className="text-2xl font-bold tracking-tight">{drop.line}</p>
          <p className="mt-1 text-sm text-white/70">Relax, the screen is fine. That was us.</p>
          <p className="mt-3 inline-block rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-ink">Back to it</p>
        </div>
      </div>
    </div>
  );
}
