"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Braces,
  Copy,
  Film,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { MUSCLES, PATTERN, PATTERNS, TOOL_LABEL, type KeyId, type Muscle, type Pattern } from "@/lib/motion/patterns";
import { frame, frameAtU, keyPose, newDraft, phaseAt, repLength, type Draft } from "@/lib/motion/motion";
import { drawFrame, project, type Cam } from "@/lib/motion/render";
import { seedLibrary } from "@/lib/motion/library";
import { POSE_DEFAULTS, solve, type Pose } from "@/lib/motion/skeleton";
import { Segmented } from "../room-ui";

const STORE = "gx-motion-lab-v1";

function load(): Draft[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const list = JSON.parse(raw) as Draft[];
      if (Array.isArray(list) && list.length && list.every((d) => PATTERN[d.pattern])) return list;
    }
  } catch {}
  return seedLibrary();
}
function save(list: Draft[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {}
}

// Where to aim the camera for a draft: the middle of the body and the machine.
function focusOf(d: Draft) {
  const { skel, pattern } = frameAtU(d, 0.5);
  const zs = [skel.pelvis.z, skel.toe.L.z, skel.heel.R.z, skel.grip.L.z, skel.head.z];
  for (const b of pattern.machine) zs.push((b.min.z + b.max.z) / 2);
  const z = (Math.min(...zs) + Math.max(...zs)) / 2;
  return { z: Math.max(-0.5, Math.min(0.5, z)) };
}

function camFor(d: Draft, w: number, h: number, yaw: number, pitch: number, zoom: number): Cam {
  const scale = h * 0.345 * zoom;
  const f = focusOf(d);
  const base: Cam = { yaw, pitch, scale, cx: w / 2, cy: h * 0.86 };
  const off = project({ x: 0, y: 0, z: f.z }, base);
  return { ...base, cx: base.cx - (off.x - w / 2) };
}

const PRESETS = [
  { label: "Front", yaw: 0 },
  { label: "¾", yaw: 45 },
  { label: "Side", yaw: 90 },
  { label: "Back", yaw: 180 },
];

// ==================================================================== studio
export function Studio() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [yaw, setYaw] = useState<number | null>(null);
  const [pitch, setPitch] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<"exercise" | "motion" | "poses">("motion");
  const [picking, setPicking] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const time = useRef(0);
  const scrub = useRef<number | null>(null); // fixed progress u while editing a pose

  useEffect(() => {
    const t = setTimeout(() => {
      const list = load();
      setDrafts(list);
      setSel(list[0].id);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (drafts) save(drafts);
  }, [drafts]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const draft = drafts?.find((d) => d.id === sel) ?? null;
  const pattern = draft ? PATTERN[draft.pattern] : null;
  const camYaw = yaw ?? pattern?.camera ?? 60;

  const update = useCallback(
    (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
      setDrafts((list) => list?.map((d) => (d.id === sel ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)) ?? null);
    },
    [sel],
  );

  const choose = (id: string) => {
    setSel(id);
    setYaw(null);
    time.current = 0;
    scrub.current = null;
    setPlaying(true);
  };

  const add = (p: Pattern) => {
    const d = newDraft(p, `New ${p.name.toLowerCase()}`);
    setDrafts((list) => [d, ...(list ?? [])]);
    choose(d.id);
    setPicking(false);
    setTab("exercise");
  };

  if (!drafts || !draft || !pattern) {
    return <div className="h-[44rem] animate-pulse rounded-3xl bg-white/[0.03]" />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
      <Library
        drafts={drafts}
        sel={sel}
        onSelect={choose}
        onNew={() => setPicking(true)}
      />

      <Stage
        draft={draft}
        pattern={pattern}
        time={time}
        scrub={scrub}
        playing={playing}
        speed={speed}
        yaw={camYaw}
        pitch={pitch}
        zoom={zoom}
        onOrbit={(dy, dp) => {
          setYaw((y) => (((y ?? camYaw) + dy) % 360 + 360) % 360);
          setPitch((p) => Math.max(0, Math.min(38, p + dp)));
        }}
        controls={
          <>
            <button
              type="button"
              onClick={() => {
                scrub.current = null;
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause" : "Play"}
              className="grid size-11 place-items-center rounded-2xl bg-brand text-ink shadow-[0_0_30px_-8px_rgb(200_241_53/0.8)] transition active:scale-95"
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
            </button>
            <Segmented value={speed} onChange={setSpeed} options={[{ value: 0.5, label: "0.5×" }, { value: 1, label: "1×" }, { value: 2, label: "2×" }]} />
            <span className="mx-1 h-6 w-px bg-white/10" />
            <Segmented
              value={PRESETS.find((p) => Math.abs(p.yaw - camYaw) < 1)?.yaw ?? -1}
              onChange={(v) => setYaw(v)}
              options={PRESETS.map((p) => ({ value: p.yaw, label: p.label }))}
            />
            <label className="ml-auto flex items-center gap-2 text-xs text-white/45">
              Zoom
              <input type="range" min={0.7} max={1.5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="room-range w-24" />
            </label>
          </>
        }
        onScrub={(t) => {
          scrub.current = null;
          time.current = t;
          setPlaying(false);
        }}
      />

      <Inspector
        draft={draft}
        pattern={pattern}
        tab={tab}
        setTab={setTab}
        update={update}
        exporting={exporting}
        onPoseFocus={(u) => {
          scrub.current = u;
          setPlaying(false);
        }}
        onPoseBlur={() => {
          scrub.current = null;
        }}
        onExportVideo={() => exportVideo(draft, camYaw, pitch, zoom, setExporting, setToast)}
        onCopyJson={() => {
          navigator.clipboard?.writeText(JSON.stringify(draft, null, 2)).then(() => setToast("Exercise copied as JSON"), () => setToast("Couldn't copy"));
        }}
        onDuplicate={() => {
          const copy = { ...structuredClone(draft), id: Math.random().toString(36).slice(2, 10), name: `${draft.name} (copy)` };
          setDrafts((list) => [copy, ...(list ?? [])]);
          choose(copy.id);
          setToast("Duplicated");
        }}
        onDelete={() => {
          if (drafts.length <= 1) return;
          const rest = drafts.filter((d) => d.id !== draft.id);
          setDrafts(rest);
          choose(rest[0].id);
        }}
        onResetLibrary={() => {
          const list = seedLibrary();
          setDrafts(list);
          choose(list[0].id);
          setToast("Library reset");
        }}
      />

      {picking && <PatternPicker onPick={add} onClose={() => setPicking(false)} />}
      {toast && (
        <div className="room-pop fixed right-6 bottom-6 z-[80] flex items-center gap-2 rounded-2xl bg-[#1a212c] px-4 py-3 text-sm font-medium shadow-2xl ring-1 ring-white/10">
          <Sparkles className="size-4 text-brand" /> {toast}
        </div>
      )}
    </div>
  );
}

// ==================================================================== stage
function Stage({
  draft,
  pattern,
  time,
  scrub,
  playing,
  speed,
  yaw,
  pitch,
  zoom,
  onOrbit,
  controls,
  onScrub,
}: {
  draft: Draft;
  pattern: Pattern;
  time: React.RefObject<number>;
  scrub: React.RefObject<number | null>;
  playing: boolean;
  speed: number;
  yaw: number;
  pitch: number;
  zoom: number;
  onOrbit: (dYaw: number, dPitch: number) => void;
  controls: ReactNode;
  onScrub: (t: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const labelEl = useRef<HTMLSpanElement>(null);
  const repEl = useRef<HTMLSpanElement>(null);
  const live = useRef({ draft, playing, speed, yaw, pitch, zoom });
  useEffect(() => {
    live.current = { draft, playing, speed, yaw, pitch, zoom };
  });

  useEffect(() => {
    const c = canvas.current;
    const b = box.current;
    if (!c || !b) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    const size = () => {
      const r = b.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(b);
    const tick = (now: number) => {
      const L = live.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (L.playing && scrub.current === null) time.current += dt * L.speed;
      const p = PATTERN[L.draft.pattern];
      const cam = camFor(L.draft, w, h, L.yaw, L.pitch, L.zoom);
      let skel;
      let label: string;
      if (scrub.current !== null) {
        skel = frameAtU(L.draft, scrub.current).skel;
        label = "Editing pose";
      } else {
        const f = frame(L.draft, time.current);
        skel = f.skel;
        label = f.label;
      }
      drawFrame(ctx, skel, { cam, width: w, height: h, primary: L.draft.primary, secondary: L.draft.secondary, tool: L.draft.tool, pattern: p });
      const total = repLength(L.draft.tempo) || 1;
      if (head.current) head.current.style.left = `${((((time.current % total) + total) % total) / total) * 100}%`;
      if (labelEl.current && labelEl.current.textContent !== label) labelEl.current.textContent = label;
      if (repEl.current) repEl.current.textContent = String(Math.floor(time.current / total) + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [time, scrub]);

  // Drag on the stage to orbit the camera.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const t = draft.tempo;
  const total = repLength(t) || 1;
  const segs = [
    { w: t.toEnd, label: pattern.verbs.toEnd, on: true },
    { w: t.holdEnd, label: "Hold", on: false },
    { w: t.toStart, label: pattern.verbs.toStart, on: true },
    { w: t.holdStart, label: "Reset", on: false },
  ];

  return (
    <section className="room-panel overflow-hidden rounded-3xl bg-[#0b0f15] ring-1 ring-white/[0.07]">
      <div
        ref={box}
        className="relative h-[34rem] cursor-grab touch-none select-none active:cursor-grabbing xl:h-[38rem]"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onOrbit((e.clientX - drag.current.x) * -0.45, (e.clientY - drag.current.y) * 0.15);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <canvas ref={canvas} className="absolute inset-0 size-full" aria-label={`${draft.name}, animated`} role="img" />
        <div className="pointer-events-none absolute top-4 left-5 right-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-brand uppercase">{pattern.name}</p>
            <p className="room-crumb text-xl font-bold tracking-tight" key={draft.id}>
              {draft.name}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur-md ring-1 ring-white/10">
            <span className="room-live size-1.5 rounded-full bg-brand" />
            <span ref={labelEl} className="font-semibold" />
            <span className="text-white/35">·</span>
            <span className="text-white/50">
              rep <span ref={repEl} className="tabular-nums" />
            </span>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-5 flex flex-wrap gap-1.5">
          {draft.primary.map((m) => (
            <span key={m} className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand ring-1 ring-brand/25">
              {MUSCLES.find((x) => x.id === m)?.label}
            </span>
          ))}
          {draft.secondary.map((m) => (
            <span key={m} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/55">
              {MUSCLES.find((x) => x.id === m)?.label}
            </span>
          ))}
        </div>
        <p className="pointer-events-none absolute right-5 bottom-4 text-[11px] text-white/30">Drag to turn</p>
      </div>

      {/* Timeline: one rep, its phases to scale, a playhead you can drag. */}
      <div className="border-t border-white/[0.06] px-5 pt-4 pb-2">
        <div
          className="relative h-9 cursor-pointer"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const go = (x: number) => onScrub(Math.max(0, Math.min(0.999, (x - r.left) / r.width)) * total);
            go(e.clientX);
            const move = (ev: PointerEvent) => go(ev.clientX);
            const up = () => {
              removeEventListener("pointermove", move);
              removeEventListener("pointerup", up);
            };
            addEventListener("pointermove", move);
            addEventListener("pointerup", up);
          }}
        >
          <div className="flex h-full gap-[3px]">
            {segs.map((s, i) => (
              <div key={i} className={`flex min-w-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold ${s.on ? "bg-brand/[0.13] text-brand" : "bg-white/[0.04] text-white/35"}`} style={{ flex: `${Math.max(0.05, s.w)} 1 0` }}>
                <span className="truncate px-1">{s.w >= 0.3 ? `${s.label} ${s.w.toFixed(1)}s` : ""}</span>
              </div>
            ))}
          </div>
          <div ref={head} className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgb(255_255_255/0.8)]" />
        </div>
        <p className="mt-1.5 text-right text-[11px] text-white/35 tabular-nums">One rep: {total.toFixed(1)} s</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-5 py-3">{controls}</div>
    </section>
  );
}

// ==================================================================== library
function Library({ drafts, sel, onSelect, onNew }: { drafts: Draft[]; sel: string | null; onSelect: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const shown = drafts.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()) || PATTERN[d.pattern].name.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="room-panel flex max-h-[48rem] flex-col overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.07]">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-white/80">Library · {drafts.length}</h2>
          <button type="button" onClick={onNew} className="flex h-8 items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-ink transition active:scale-95">
            <Plus className="size-3.5" /> New
          </button>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.07]">
          <Search className="size-4 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
        </label>
      </div>
      <ul className="room-rows room-scroll flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {shown.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${d.id === sel ? "bg-white/[0.08] ring-1 ring-brand/30" : "hover:bg-white/[0.04]"}`}
            >
              <Thumb draft={d} active={d.id === sel} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{d.name}</span>
                <span className="block truncate text-[11px] text-white/40">
                  {PATTERN[d.pattern].name} · {TOOL_LABEL[d.tool]}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-8 text-center text-sm text-white/35">No exercise matches.</li>}
      </ul>
    </section>
  );
}

// A small preview: still at rest, it plays when hovered or selected.
function Thumb({ draft, active, size = 52 }: { draft: Draft; active: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(false);
  const run = hover || active;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = size;
    c.width = S * dpr;
    c.height = S * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = PATTERN[draft.pattern];
    const cam = camFor(draft, S, S, p.camera, 10, size > 60 ? 1.05 : 1.12);
    const paint = (u: number) =>
      drawFrame(ctx, frameAtU(draft, u).skel, { cam, width: S, height: S, primary: draft.primary, secondary: draft.secondary, tool: draft.tool, pattern: p, simple: true });
    if (!run) {
      paint(0.65);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      paint(phaseAt(p, draft.tempo, (now - start) / 1000).u);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draft, run, size]);
  return (
    <canvas
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-xl ring-1 transition ${active ? "ring-brand/40" : "ring-white/[0.06] group-hover:ring-white/15"}`}
    />
  );
}

// ==================================================================== inspector
const FIELD: Record<string, { label: string; unit: "cm" | "°"; span: number }> = {
  pelvisY: { label: "Hip height", unit: "cm", span: 0.3 },
  pelvisZ: { label: "Hips forward", unit: "cm", span: 0.3 },
  trunk: { label: "Torso lean", unit: "°", span: 40 },
  chest: { label: "Upper back", unit: "°", span: 30 },
  head: { label: "Head tilt", unit: "°", span: 30 },
  stance: { label: "Stance", unit: "cm", span: 0.15 },
  footLZ: { label: "Left foot forward", unit: "cm", span: 0.3 },
  footRZ: { label: "Right foot forward", unit: "cm", span: 0.3 },
  footRY: { label: "Right heel lift", unit: "cm", span: 0.15 },
  hipL: { label: "Left hip", unit: "°", span: 45 },
  hipR: { label: "Right hip", unit: "°", span: 45 },
  kneeL: { label: "Left knee", unit: "°", span: 60 },
  kneeR: { label: "Right knee", unit: "°", span: 60 },
  hipAbd: { label: "Knees out", unit: "°", span: 20 },
  footPitch: { label: "Foot angle", unit: "°", span: 40 },
  handL: { label: "Hands apart", unit: "cm", span: 0.2 },
  handU: { label: "Hands up", unit: "cm", span: 0.3 },
  handF: { label: "Hands forward", unit: "cm", span: 0.3 },
  shFlex: { label: "Arms forward", unit: "°", span: 45 },
  shAbd: { label: "Arms out", unit: "°", span: 45 },
  elbow: { label: "Elbow bend", unit: "°", span: 60 },
};

function Inspector({
  draft,
  pattern,
  tab,
  setTab,
  update,
  exporting,
  onPoseFocus,
  onPoseBlur,
  onExportVideo,
  onCopyJson,
  onDuplicate,
  onDelete,
  onResetLibrary,
}: {
  draft: Draft;
  pattern: Pattern;
  tab: "exercise" | "motion" | "poses";
  setTab: (t: "exercise" | "motion" | "poses") => void;
  update: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;
  exporting: number | null;
  onPoseFocus: (u: number) => void;
  onPoseBlur: () => void;
  onExportVideo: () => void;
  onCopyJson: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onResetLibrary: () => void;
}) {
  return (
    <section className="room-panel flex max-h-[48rem] flex-col overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.07]">
      <div className="p-4 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "exercise", label: "Exercise" },
            { value: "motion", label: "Motion" },
            { value: "poses", label: "Poses" },
          ]}
        />
      </div>
      <div className="room-scroll flex-1 overflow-y-auto px-4 pb-4" key={tab + draft.id}>
        <div className="room-head space-y-5">
          {tab === "exercise" && <ExerciseTab draft={draft} pattern={pattern} update={update} />}
          {tab === "motion" && <MotionTab draft={draft} pattern={pattern} update={update} />}
          {tab === "poses" && <PosesTab draft={draft} pattern={pattern} update={update} onFocus={onPoseFocus} onBlur={onPoseBlur} />}
        </div>
      </div>
      <div className="space-y-2 border-t border-white/[0.06] p-4">
        <button
          type="button"
          onClick={onExportVideo}
          disabled={exporting !== null}
          className="relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-90"
        >
          {exporting !== null && <span className="absolute inset-y-0 left-0 bg-white/40 transition-[width] duration-200" style={{ width: `${exporting * 100}%` }} />}
          <span className="relative flex items-center gap-2">
            {exporting !== null ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
            {exporting !== null ? `Recording ${Math.round(exporting * 100)}%` : "Export video"}
          </span>
        </button>
        <div className="grid grid-cols-4 gap-2">
          <IconBtn label="Copy as JSON" onClick={onCopyJson} icon={<Braces className="size-4" />} />
          <IconBtn label="Duplicate" onClick={onDuplicate} icon={<Copy className="size-4" />} />
          <IconBtn label="Delete" onClick={onDelete} icon={<Trash2 className="size-4" />} danger />
          <IconBtn label="Reset library" onClick={onResetLibrary} icon={<RotateCcw className="size-4" />} />
        </div>
      </div>
    </section>
  );
}

function IconBtn({ label, icon, onClick, danger }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-10 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] transition hover:bg-white/[0.08] active:scale-95 ${danger ? "text-rose-300/80 hover:text-rose-300" : "text-white/60 hover:text-white"}`}
    >
      {icon}
    </button>
  );
}

function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  show,
  onChange,
  onFocus,
  onBlur,
  dirty,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: string;
  onChange: (v: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  dirty?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-white/65">
          {dirty && <span className="size-1.5 rounded-full bg-brand" />}
          {label}
        </span>
        <span className="font-semibold text-white tabular-nums">{show}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={onFocus}
        onFocus={onFocus}
        onPointerUp={onBlur}
        onBlur={onBlur}
        className="room-range mt-1.5 w-full"
        style={fillStyle(value, min, max)}
      />
    </label>
  );
}

function ExerciseTab({ draft, pattern, update }: { draft: Draft; pattern: Pattern; update: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void }) {
  const cycle = (m: Muscle) =>
    update((d) => {
      if (d.primary.includes(m)) return { primary: d.primary.filter((x) => x !== m), secondary: [...d.secondary, m] };
      if (d.secondary.includes(m)) return { secondary: d.secondary.filter((x) => x !== m) };
      return { primary: [...d.primary, m] };
    });
  return (
    <>
      <Group title="Name">
        <input value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={60} className="h-11 w-full rounded-xl bg-white/[0.04] px-3.5 text-sm font-semibold text-white ring-1 ring-white/[0.08] outline-none focus:ring-brand/50" />
      </Group>
      <Group title="Built on">
        <p className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm ring-1 ring-white/[0.06]">
          <SlidersHorizontal className="size-4 text-brand" /> {pattern.name} pattern
        </p>
      </Group>
      {pattern.tools.length > 1 && (
        <Group title="In the hands">
          <Segmented value={draft.tool} onChange={(t) => update({ tool: t })} options={pattern.tools.map((t) => ({ value: t, label: TOOL_LABEL[t] }))} />
        </Group>
      )}
      <Group title="Muscles" action={<span className="text-[10px] text-white/35">tap: main → helping → off</span>}>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLES.map((m) => {
            const p = draft.primary.includes(m.id);
            const s = draft.secondary.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => cycle(m.id)}
                className={`h-8 rounded-full px-3 text-xs font-semibold transition active:scale-95 ${p ? "bg-brand text-ink" : s ? "bg-brand/15 text-brand ring-1 ring-brand/30" : "bg-white/[0.04] text-white/45 ring-1 ring-white/[0.07] hover:text-white"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Group>
    </>
  );
}

function MotionTab({ draft, pattern, update }: { draft: Draft; pattern: Pattern; update: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void }) {
  const t = draft.tempo;
  const setT = (k: keyof Draft["tempo"], v: number) => update((d) => ({ tempo: { ...d.tempo, [k]: v } }));
  return (
    <>
      <Group title="Shape">
        <div className="space-y-4">
          <Slider label="Range of motion" value={draft.range} min={0.3} max={1} step={0.01} show={`${Math.round(draft.range * 100)}%`} onChange={(v) => update({ range: v })} dirty={draft.range !== 1} />
          {pattern.adjust.stance && <Slider label="Stance" value={draft.stance} min={-0.06} max={0.14} step={0.005} show={signed(draft.stance * 100, "cm")} onChange={(v) => update({ stance: v })} dirty={draft.stance !== 0} />}
          {pattern.adjust.grip && <Slider label="Grip width" value={draft.grip} min={-0.12} max={0.16} step={0.005} show={signed(draft.grip * 100, "cm")} onChange={(v) => update({ grip: v })} dirty={draft.grip !== 0} />}
          <Slider label="Extra lean at the end" value={draft.lean} min={-15} max={15} step={1} show={signed(draft.lean, "°")} onChange={(v) => update({ lean: v })} dirty={draft.lean !== 0} />
        </div>
      </Group>
      <Group title="Tempo" action={<span className="text-[10px] text-white/35 tabular-nums">{repLength(t).toFixed(1)} s a rep</span>}>
        <div className="space-y-4">
          <Slider label={pattern.verbs.toEnd} value={t.toEnd} min={0.4} max={4} step={0.1} show={`${t.toEnd.toFixed(1)} s`} onChange={(v) => setT("toEnd", v)} />
          <Slider label="Hold" value={t.holdEnd} min={0} max={3} step={0.1} show={`${t.holdEnd.toFixed(1)} s`} onChange={(v) => setT("holdEnd", v)} />
          <Slider label={pattern.verbs.toStart} value={t.toStart} min={0.4} max={4} step={0.1} show={`${t.toStart.toFixed(1)} s`} onChange={(v) => setT("toStart", v)} />
          <Slider label="Pause before the next rep" value={t.holdStart} min={0} max={3} step={0.1} show={`${t.holdStart.toFixed(1)} s`} onChange={(v) => setT("holdStart", v)} />
        </div>
      </Group>
      <button type="button" onClick={() => update({ tempo: { ...pattern.tempo }, range: 1, stance: 0, grip: 0, lean: 0 })} className="flex items-center gap-1.5 text-xs font-medium text-white/45 transition hover:text-white">
        <RotateCcw className="size-3.5" /> Back to the pattern&apos;s defaults
      </button>
    </>
  );
}

// Lime from the zero point to the value: from the left for amounts, from the
// middle for plus/minus adjustments.
function fillStyle(value: number, min: number, max: number) {
  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  const zero = min < 0 && max > 0 ? pct(0) : 0;
  const a = Math.min(zero, pct(value));
  const b = Math.max(zero, pct(value));
  const track = "rgb(255 255 255 / 0.08)";
  return { background: `linear-gradient(90deg, ${track} ${a}%, #c8f135 ${a}%, #c8f135 ${b}%, ${track} ${b}%)` };
}

const signed = (n: number, unit: string) => `${n > 0 ? "+" : ""}${Math.round(n * 10) / 10}${unit === "°" ? "°" : ` ${unit}`}`;

function PosesTab({
  draft,
  pattern,
  update,
  onFocus,
  onBlur,
}: {
  draft: Draft;
  pattern: Pattern;
  update: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;
  onFocus: (u: number) => void;
  onBlur: () => void;
}) {
  const keys = pattern.keys;
  const [key, setKey] = useState<KeyId>(keys[keys.length - 1].id);
  const k = keys.find((x) => x.id === key) ?? keys[0];
  const fields = useMemo(() => Object.keys(k.pose).filter((f) => FIELD[f]), [k]);
  const tweaks = draft.tweaks[key] ?? {};
  const pose = keyPose(pattern, draft, key);
  const u = k.at / Math.max(0.01, draft.range);
  // Show the chosen pose while this tab is open.
  useEffect(() => {
    onFocus(Math.min(1, u));
    return onBlur;
  }, [u, onFocus, onBlur]);

  const set = (f: string, delta: number) =>
    update((d) => {
      const next: Pose = { ...(d.tweaks[key] ?? {}), [f]: delta };
      if (Math.abs(delta) < 1e-6) delete next[f];
      return { tweaks: { ...d.tweaks, [key]: next } };
    });

  return (
    <>
      <Group title="Key pose">
        <Segmented
          value={key}
          onChange={setKey}
          options={keys.map((x) => ({ value: x.id, label: x.id === "start" ? "Start" : x.id === "mid" ? "Middle" : "End" }))}
        />
        <p className="mt-2 text-xs text-white/40">The stage holds this pose while you shape it. Play to see the whole rep.</p>
      </Group>
      <Group
        title="Joints"
        action={
          Object.keys(tweaks).length > 0 && (
            <button type="button" onClick={() => update((d) => ({ tweaks: { ...d.tweaks, [key]: {} } }))} className="flex items-center gap-1 text-[11px] font-medium text-white/45 hover:text-white">
              <X className="size-3" /> Reset pose
            </button>
          )
        }
      >
        <div className="space-y-4">
          {fields.map((f) => {
            const meta = FIELD[f];
            const delta = tweaks[f] ?? 0;
            const abs = pose[f] ?? POSE_DEFAULTS[f] ?? 0;
            const step = meta.unit === "cm" ? 0.005 : 1;
            return (
              <Slider
                key={f}
                label={meta.label}
                value={delta}
                min={-meta.span}
                max={meta.span}
                step={step}
                dirty={delta !== 0}
                show={meta.unit === "cm" ? `${Math.round(abs * 100)} cm` : `${Math.round(abs)}°`}
                onChange={(v) => set(f, v)}
              />
            );
          })}
        </div>
      </Group>
      <p className="text-[11px] leading-relaxed text-white/35">
        Bones keep their length: hands and feet reach for their targets, and joints bend the way a body does.
      </p>
      <Validity draft={draft} pattern={pattern} />
    </>
  );
}

// Flags poses the body can't reach (a hand short of its bar, a foot off its spot).
function Validity({ draft, pattern }: { draft: Draft; pattern: Pattern }) {
  const issues: string[] = [];
  for (const k of pattern.keys) {
    const pose = { ...POSE_DEFAULTS, ...keyPose(pattern, draft, k.id) };
    const s = solve(pose, pattern.rig);
    if (pattern.rig.legs.mode === "planted") {
      const want = pose.footLZ;
      if (Math.abs(s.ankle.L.z - want) > 0.02 || Math.abs(s.ankle.L.y - (0.075 + pose.footLY)) > 0.02) issues.push(`${label(k.id)}: the legs can't reach the floor spot.`);
    }
  }
  if (!issues.length) return null;
  return (
    <div className="rounded-2xl bg-amber-400/[0.08] px-3.5 py-3 text-xs text-amber-200 ring-1 ring-amber-300/20">
      {issues.map((i) => (
        <p key={i}>{i}</p>
      ))}
    </div>
  );
}
const label = (k: KeyId) => (k === "start" ? "Start" : k === "mid" ? "Middle" : "End");

// ==================================================================== new
function PatternPicker({ onPick, onClose }: { onPick: (p: Pattern) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button aria-label="Close" className="room-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="New exercise" className="room-pop relative w-full max-w-3xl rounded-3xl bg-[#11161f] p-6 shadow-2xl ring-1 ring-white/10">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">New exercise</p>
            <h2 className="mt-1 text-xl font-bold">Start from a movement</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-white/45 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <ul className="room-rows grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PATTERNS.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} className="group flex w-full flex-col items-center gap-2 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06] transition hover:bg-white/[0.06] hover:ring-brand/30 active:scale-[0.98]">
                <Thumb draft={newDraft(p)} active={false} size={96} />
                <span className="text-sm font-semibold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ==================================================================== export
// Records two reps at 1080 × 1080 into a WebM, with the name and the Gymix mark.
function exportVideo(draft: Draft, yaw: number, pitch: number, zoom: number, setProgress: (n: number | null) => void, toast: (s: string) => void) {
  const S = 1080;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx || typeof MediaRecorder === "undefined" || !c.captureStream) {
    toast("This browser can't record video");
    return;
  }
  const p = PATTERN[draft.pattern];
  const cam = camFor(draft, S, S, yaw, pitch, zoom);
  const stream = c.captureStream(60);
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setProgress(null);
    toast("Video saved");
  };
  const duration = repLength(draft.tempo) * 2;
  const start = performance.now();
  rec.start();
  setProgress(0);
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    const f = frame(draft, t);
    drawFrame(ctx, f.skel, { cam, width: S, height: S, primary: draft.primary, secondary: draft.secondary, tool: draft.tool, pattern: p });
    ctx.save();
    ctx.fillStyle = "#c8f135";
    ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(p.name.toUpperCase(), 64, 92);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 54px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(draft.name, 64, 150);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 26px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(f.label, 64, S - 64);
    ctx.textAlign = "right";
    ctx.fillStyle = "#c8f135";
    ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Gymix", S - 64, S - 64);
    ctx.restore();
    setProgress(Math.min(1, t / duration));
    if (t < duration) requestAnimationFrame(tick);
    else rec.stop();
  };
  requestAnimationFrame(tick);
}
