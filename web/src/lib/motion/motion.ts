import { PATTERN, type KeyId, type Muscle, type Pattern, type Tempo, type Tool } from "./patterns";
import { blend, solve, type Pose, type Skeleton } from "./skeleton";

// An exercise in the lab: a pattern, the tool in the hands, the muscles to
// light up, how far and how fast, and any hand-tuned changes to its key poses.
export type Draft = {
  id: string;
  name: string;
  pattern: string;
  tool: Tool;
  primary: Muscle[];
  secondary: Muscle[];
  tempo: Tempo;
  range: number; // 0.3–1: how far toward the end pose
  stance: number; // metres added to the stance
  grip: number; // metres added to the grip
  lean: number; // degrees added to the trunk at the end pose
  tweaks: Partial<Record<KeyId | "all", Pose>>;
  yaw?: number;
};

export function newDraft(pattern: Pattern, name = pattern.name): Draft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    pattern: pattern.id,
    tool: pattern.tools[0],
    primary: [...pattern.muscles.primary],
    secondary: [...pattern.muscles.secondary],
    tempo: { ...pattern.tempo },
    range: 1,
    stance: 0,
    grip: 0,
    lean: 0,
    tweaks: {},
  };
}

// A key pose with the draft's adjustments and tweaks applied.
export function keyPose(p: Pattern, d: Draft, id: KeyId): Pose {
  const key = p.keys.find((k) => k.id === id) ?? p.keys[0];
  const out: Pose = { ...key.pose };
  for (const extra of [d.tweaks.all, d.tweaks[id]]) {
    for (const [k, v] of Object.entries(extra ?? {})) out[k] = (out[k] ?? 0) + v;
  }
  if (p.adjust.stance && "stance" in out) out.stance += d.stance;
  if (p.adjust.grip && p.rig.arms.mode === "ik") out.handL = (out.handL ?? 0.25) + d.grip;
  out.trunk = (out.trunk ?? 0) + d.lean * key.at;
  return out;
}

// The pose at progress u (0 = start, 1 = end) along the pattern's keys.
export function poseAlong(p: Pattern, d: Draft, u: number): Pose {
  const keys = p.keys;
  const t = Math.min(1, Math.max(0, u)) * d.range;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.at || i === keys.length - 2) {
      const local = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
      return blend(keyPose(p, d, a.id), keyPose(p, d, b.id), Math.min(1, Math.max(0, local)));
    }
  }
  return keyPose(p, d, keys[0].id);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const repLength = (t: Tempo) => t.toEnd + t.holdEnd + t.toStart + t.holdStart;

// Where a rep is at `time` seconds: progress u and the phase's name.
export function phaseAt(p: Pattern, tempo: Tempo, time: number) {
  const total = repLength(tempo) || 1;
  let s = ((time % total) + total) % total;
  if (s < tempo.toEnd) return { u: ease(s / tempo.toEnd), label: p.verbs.toEnd, phase: 0 };
  s -= tempo.toEnd;
  if (s < tempo.holdEnd) return { u: 1, label: "Hold", phase: 1 };
  s -= tempo.holdEnd;
  if (s < tempo.toStart) return { u: 1 - ease(s / tempo.toStart), label: p.verbs.toStart, phase: 2 };
  return { u: 0, label: "Reset", phase: 3 };
}

export function frame(d: Draft, time: number): { skel: Skeleton; pattern: Pattern; label: string; u: number } {
  const pattern = PATTERN[d.pattern];
  const ph = phaseAt(pattern, d.tempo, time);
  return { skel: solve(poseAlong(pattern, d, ph.u), pattern.rig), pattern, label: ph.label, u: ph.u };
}

export function frameAtU(d: Draft, u: number) {
  const pattern = PATTERN[d.pattern];
  return { skel: solve(poseAlong(pattern, d, u), pattern.rig), pattern };
}
