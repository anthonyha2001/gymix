"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsRight, DoorClosed, DoorOpen, Loader2, X } from "lucide-react";
import { showToast } from "@/components/toaster";
import { openDoor, type OpenState } from "@/app/door-actions";
import { waitForOpen } from "@/components/open-door-button";
import { haptics } from "@/lib/haptics";

type Phase = "idle" | "dragging" | "opening" | "opened" | "failed";
const KNOB = 56; // px
const PAD = 4; // px around the knob

// "Slide to open": the door handle follows the thumb across the track, the
// track fills lime behind it, the phone ticks at each quarter and clunks at
// the end. Letting go before the end springs it back, so a pocket or a stray
// tap never opens a door. Keyboard: focus the handle and press Enter.
export function SlideToOpen({ deviceId, name }: { deviceId: string; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; max: number } | null>(null);
  const quarter = useRef(0);
  const [x, setX] = useState(0);
  const [max, setMax] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [burst, setBurst] = useState(0);
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  const progress = max ? Math.min(1, x / max) : 0;
  const locked = phase === "opening" || phase === "opened" || phase === "failed";

  function measure() {
    const w = track.current?.clientWidth ?? 0;
    const m = Math.max(0, w - KNOB - PAD * 2);
    setMax(m);
    return m;
  }

  async function fire() {
    const m = max || measure();
    setX(m);
    setPhase("opening");
    haptics.heavy();
    const r = await openDoor(deviceId);
    let final: OpenState = "failed";
    if (!r.ok) showToast(r.error, "error");
    else final = await waitForOpen(r.commandId);
    const ok = final === "opened" || final === "sent";
    if (ok) {
      setPhase("opened");
      setBurst(Date.now());
      haptics.success();
      if (final === "sent") showToast(`${name}: sent to the door.`);
    } else {
      setPhase("failed");
      haptics.error();
      if (r.ok) showToast(`${name} didn't answer. Is the device online?`, "error");
    }
    reset.current = setTimeout(() => {
      setPhase("idle");
      setX(0);
    }, ok ? 3200 : 2200);
  }

  const label =
    phase === "opening" ? `Opening ${name}…` : phase === "opened" ? `${name} is open` : phase === "failed" ? "Didn't open. Try again" : `Slide to open ${name}`;

  return (
    <div
      ref={track}
      className={`slide-track relative h-16 w-full select-none overflow-hidden rounded-full p-1 transition-colors duration-300 ${
        phase === "opened" ? "bg-success" : phase === "failed" ? "slide-shake bg-danger" : "bg-ink"
      }`}
      role="group"
      aria-label={label}
    >
      {/* The lime fill that follows the handle. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-brand"
        style={{
          width: `${KNOB + x}px`,
          opacity: phase === "opened" || phase === "failed" ? 0 : 0.18 + progress * 0.82,
          transition: phase === "dragging" ? "none" : "width 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms",
        }}
      />
      <span
        aria-live="polite"
        className={`pointer-events-none absolute inset-0 flex items-center justify-center pl-14 text-sm font-semibold ${
          phase === "idle" || phase === "dragging" ? "slide-label text-white/70" : "text-white"
        }`}
        style={{ opacity: phase === "dragging" ? Math.max(0, 1 - progress * 1.6) : 1, transition: "opacity 150ms" }}
      >
        {phase === "idle" || phase === "dragging" ? (
          <span className="flex items-center gap-1.5">
            {label} <ChevronsRight className="size-4" />
          </span>
        ) : (
          label
        )}
      </span>

      <button
        type="button"
        aria-label={`Open ${name}`}
        disabled={locked}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && !locked) {
            e.preventDefault();
            fire();
          }
        }}
        onPointerDown={(e) => {
          if (locked) return;
          const m = measure();
          start.current = { x: e.clientX - x, max: m };
          quarter.current = 0;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setPhase("dragging");
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const nx = Math.min(start.current.max, Math.max(0, e.clientX - start.current.x));
          const q = Math.floor((nx / (start.current.max || 1)) * 4);
          if (q > quarter.current) haptics.tick();
          quarter.current = q;
          setX(nx);
        }}
        onPointerUp={() => {
          if (!start.current) return;
          const done = x >= start.current.max * 0.88;
          start.current = null;
          if (done) fire();
          else {
            setPhase("idle");
            setX(0);
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setPhase("idle");
          setX(0);
        }}
        className={`slide-knob relative z-10 grid touch-none place-items-center rounded-full bg-brand text-ink shadow-lg ${
          phase === "opened" ? "bg-white text-success" : phase === "failed" ? "bg-white text-danger" : ""
        } ${phase === "idle" ? "slide-knob-idle cursor-grab" : ""} ${phase === "dragging" ? "cursor-grabbing" : ""}`}
        style={{
          width: KNOB,
          height: KNOB,
          transform: `translateX(${x}px) scale(${phase === "dragging" ? 1.06 : 1})`,
          transition: phase === "dragging" ? "transform 60ms linear" : "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {phase === "opening" ? (
          <Loader2 className="size-6 animate-spin" />
        ) : phase === "opened" ? (
          <Check className="check-pop size-7" strokeWidth={3} />
        ) : phase === "failed" ? (
          <X className="size-7" strokeWidth={3} />
        ) : progress > 0.85 ? (
          <DoorOpen className="size-6" />
        ) : (
          <DoorClosed className="size-6" style={{ transform: `perspective(80px) rotateY(${-progress * 40}deg)` }} />
        )}
        {burst && phase === "opened" ? <span key={burst} aria-hidden className="slide-burst" /> : null}
      </button>
    </div>
  );
}
