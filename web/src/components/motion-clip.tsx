"use client";

import { useEffect, useRef } from "react";
import { seedLibrary } from "@/lib/motion/library";
import { frame, frameAtU, type Draft } from "@/lib/motion/motion";
import { PATTERN } from "@/lib/motion/patterns";
import { drawFrame } from "@/lib/motion/render";
import type { Skeleton } from "@/lib/motion/skeleton";
import { boundsOf, camFor } from "@/lib/motion/view";

let byId: Map<string, Draft> | null = null;
export function motionDraft(id: string) {
  byId ??= new Map(seedLibrary().map((d) => [d.id, d]));
  return byId.get(id);
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A Gymix motion clip: the exercise performed by the athlete, playing on a
// loop while it is on screen. `live` uses the 3D athlete (detail views);
// otherwise the light flat renderer is used (lists, cards).
export function MotionClip({ id, name, className = "size-20", live = false }: { id: string; name: string; className?: string; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const d = motionDraft(id);
    const c = canvas.current;
    const b = box.current;
    if (!d || !c || !b) return;
    const p = PATTERN[d.pattern];
    const still = reduced();
    let dead = false;
    let raf = 0;
    let visible = false;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t = 0;
    let last = performance.now();
    let ctx: CanvasRenderingContext2D | null = null;
    let scene: import("@/lib/motion/render3d").MotionScene | null = null;
    let rest: Skeleton | null = null;
    const bounds = boundsOf(d);

    const paint = (skel: Skeleton, label: string, now: number) => {
      if (scene) {
        scene.frame(skel, now / 1000);
        scene.render();
      } else if (ctx) {
        drawFrame(ctx, skel, { cam: camFor(d, w, h, p.camera, 10, live ? 1 : 1.08), width: w, height: h, primary: d.primary, secondary: d.secondary, tool: d.tool, pattern: p, simple: !live });
      }
      if (phase.current && phase.current.textContent !== label) phase.current.textContent = label;
    };
    const draw = (now: number) => {
      if (still) {
        paint(frameAtU(d, 0.65).skel, "", now);
        return;
      }
      const f = frame(d, t);
      paint(f.skel, f.label, now);
    };
    const tick = (now: number) => {
      if (dead) return;
      t += Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(now);
      raf = visible && !still ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!raf && !dead) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const size = () => {
      const r = b.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      if (scene) {
        scene.resize(w, h, dpr);
        scene.view(p.camera, 10, 1, bounds.target, bounds.radius);
      } else if (ctx) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      draw(performance.now());
    };
    const flat = () => {
      ctx = c.getContext("2d");
      size();
    };

    const io = new IntersectionObserver(
      (e) => {
        visible = e.some((x) => x.isIntersecting);
        if (visible) start();
      },
      { rootMargin: "100px" },
    );
    const ro = new ResizeObserver(size);

    (async () => {
      if (live) {
        try {
          const mod = await import("@/lib/motion/render3d");
          if (dead) return;
          scene = new mod.MotionScene(c);
          rest = frameAtU(d, 0).skel;
          scene.look({ primary: d.primary, secondary: d.secondary, tool: d.tool, pattern: p, rest });
          size();
          void scene.useAthlete("/motion/athlete.glb").then(() => scene && scene.look({ primary: d.primary, secondary: d.secondary, tool: d.tool, pattern: p, rest: rest! }));
        } catch {
          scene = null;
          flat();
        }
      } else flat();
      if (dead) return;
      ro.observe(b);
      io.observe(b);
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      scene?.dispose();
    };
  }, [id, live]);

  return (
    <div ref={box} className={`relative shrink-0 overflow-hidden rounded-lg bg-[#0b0e13] ${className}`}>
      <canvas ref={canvas} role="img" aria-label={`How to do ${name}`} className="absolute inset-0 size-full" />
      {live && (
        <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="size-1.5 rounded-full bg-brand" />
          <span ref={phase} />
        </span>
      )}
    </div>
  );
}
