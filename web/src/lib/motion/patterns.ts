import { v3, type Pose, type Rig, type V3 } from "./skeleton";

// Movement patterns: each is a rig, its key poses (start → end, with an
// optional middle to shape the path), the machine around it and the tools the
// hands can hold. Exercises are patterns plus adjustments.

export type Muscle = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "core" | "glutes" | "quads" | "hamstrings" | "calves";
export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Forearms" },
  { id: "core", label: "Core" },
  { id: "glutes", label: "Glutes" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "calves", label: "Calves" },
];

export type Tool = "barbell" | "dumbbells" | "none" | "latbar" | "shortbar" | "vhandle" | "roller";
export const TOOL_LABEL: Record<Tool, string> = {
  barbell: "Barbell",
  dumbbells: "Dumbbells",
  none: "Bodyweight",
  latbar: "Lat bar",
  shortbar: "Straight bar",
  vhandle: "V-handle",
  roller: "Leg roller",
};

export type Box = { min: V3; max: V3; tone: "pad" | "frame" | "steel"; under?: boolean };
export type KeyId = "start" | "mid" | "end";
export type Tempo = { toEnd: number; holdEnd: number; toStart: number; holdStart: number };

export type Pattern = {
  id: string;
  name: string;
  rig: Rig;
  keys: { id: KeyId; at: number; pose: Pose }[];
  // What the move toward the end / back to the start is called.
  verbs: { toEnd: string; toStart: string };
  tools: Tool[];
  machine: Box[];
  pulley?: V3;
  muscles: { primary: Muscle[]; secondary: Muscle[] };
  tempo: Tempo;
  // Which adjustments make sense here.
  adjust: { stance: boolean; grip: boolean };
  camera: number;
};

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tone: Box["tone"], under = false): Box => ({ min: v3(x0, y0, z0), max: v3(x1, y1, z1), tone, under });
const STAND = { pelvisY: 0.92, pelvisZ: 0, trunk: 2, stance: 0.13 };
const PLANTED: Rig["legs"] = { mode: "planted", pole: v3(0.25, 0, 1) };
const ARM_HANG = { shFlex: 2, shAbd: 7, elbow: 8 };
// Lying on the bench, feet on the floor (bench press, flyes, skull crushers).
const LYING = { pelvisY: 0.53, pelvisZ: 0, trunk: -90, head: 8, stance: 0.26, footLZ: 0.52, footRZ: 0.52 };
const BENCH: Box[] = [
  box(-0.16, 0.36, -0.95, 0.16, 0.44, 0.2, "pad", true),
  box(-0.1, 0, -0.85, 0.1, 0.36, -0.77, "frame", true),
  box(-0.1, 0, 0.04, 0.1, 0.36, 0.12, "frame", true),
  box(-0.3, 0, -0.9, 0.3, 0.03, -0.72, "frame", true),
  box(-0.6, 0, -0.66, -0.52, 1.18, -0.58, "frame"),
  box(0.52, 0, -0.66, 0.6, 1.18, -0.58, "frame"),
];
const LEGEXT: Box[] = [
  box(-0.2, 0.38, -0.2, 0.2, 0.47, 0.32, "pad", true),
  box(-0.12, 0, -0.12, 0.12, 0.38, 0.2, "frame", true),
  box(-0.2, 0.47, -0.37, 0.2, 1.08, -0.27, "pad", true),
  box(-0.3, 0, -0.45, 0.3, 0.04, 0.35, "frame", true),
];
// A floor mat for push-ups, crunches and bridges.
const MAT: Box[] = [box(-0.32, 0, -1.35, 0.32, 0.012, 0.85, "pad", true)];

export const PATTERNS: Pattern[] = [
  {
    id: "squat",
    name: "Squat",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.5, -1, -0.4) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.92, pelvisZ: -0.02, trunk: 6, stance: 0.17, handL: 0.38, handU: -0.02, handF: -0.07 } },
      { id: "mid", at: 0.5, pose: { pelvisY: 0.73, pelvisZ: -0.17, trunk: 24, stance: 0.17, handL: 0.38, handU: -0.02, handF: -0.07 } },
      { id: "end", at: 1, pose: { pelvisY: 0.5, pelvisZ: -0.3, trunk: 38, stance: 0.17, handL: 0.38, handU: -0.02, handF: -0.07 } },
    ],
    verbs: { toEnd: "Lower", toStart: "Stand" },
    tools: ["barbell", "none"],
    machine: [],
    muscles: { primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] },
    tempo: { toEnd: 2, holdEnd: 0.4, toStart: 1.2, holdStart: 0.8 },
    adjust: { stance: true, grip: true },
    camera: 62,
  },
  {
    id: "deadlift",
    name: "Deadlift",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.2, 0, -1), frame: "world" } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.6, pelvisZ: -0.3, trunk: 62, head: -10, stance: 0.13, handL: 0.24, handU: 0.235, handF: 0.05 } },
      { id: "mid", at: 0.45, pose: { pelvisY: 0.74, pelvisZ: -0.19, trunk: 45, head: -8, stance: 0.13, handL: 0.24, handU: 0.52, handF: 0.07 } },
      { id: "end", at: 1, pose: { pelvisY: 0.93, pelvisZ: 0, trunk: 0, head: 0, stance: 0.13, handL: 0.24, handU: 0.8, handF: 0.1 } },
    ],
    verbs: { toEnd: "Lift", toStart: "Lower" },
    tools: ["barbell"],
    machine: [],
    muscles: { primary: ["hamstrings", "glutes", "back"], secondary: ["quads", "forearms", "core"] },
    tempo: { toEnd: 1.2, holdEnd: 0.6, toStart: 1.6, holdStart: 0.7 },
    adjust: { stance: true, grip: true },
    camera: 52,
  },
  {
    id: "lunge",
    name: "Lunge",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) }, tiptoe: ["R"] },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.84, pelvisZ: 0, trunk: 3, stance: 0.11, footLZ: 0.38, footRZ: -0.5, footRY: 0.085, ...ARM_HANG } },
      { id: "end", at: 1, pose: { pelvisY: 0.52, pelvisZ: 0, trunk: 5, stance: 0.11, footLZ: 0.38, footRZ: -0.5, footRY: 0.085, ...ARM_HANG } },
    ],
    verbs: { toEnd: "Lower", toStart: "Drive up" },
    tools: ["dumbbells", "none"],
    machine: [],
    muscles: { primary: ["quads", "glutes"], secondary: ["hamstrings", "calves", "core"] },
    tempo: { toEnd: 1.6, holdEnd: 0.3, toStart: 1.1, holdStart: 0.6 },
    adjust: { stance: true, grip: false },
    camera: 70,
  },
  {
    id: "bench",
    name: "Bench press",
    rig: { legs: { mode: "planted", pole: v3(0.35, 1, 0.3) }, arms: { mode: "ik", pole: v3(1, -0.25, -0.6) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.53, pelvisZ: 0, trunk: -90, head: 8, stance: 0.26, footLZ: 0.52, footRZ: 0.52, handL: 0.4, handU: -0.13, handF: 0.5 } },
      { id: "end", at: 1, pose: { pelvisY: 0.53, pelvisZ: 0, trunk: -90, head: 8, stance: 0.26, footLZ: 0.52, footRZ: 0.52, handL: 0.4, handU: -0.13, handF: 0.13 } },
    ],
    verbs: { toEnd: "Lower", toStart: "Press" },
    tools: ["barbell", "dumbbells"],
    machine: [
      box(-0.16, 0.36, -0.95, 0.16, 0.44, 0.2, "pad", true),
      box(-0.1, 0, -0.85, 0.1, 0.36, -0.77, "frame", true),
      box(-0.1, 0, 0.04, 0.1, 0.36, 0.12, "frame", true),
      box(-0.3, 0, -0.9, 0.3, 0.03, -0.72, "frame", true),
      box(-0.6, 0, -0.66, -0.52, 1.18, -0.58, "frame"),
      box(0.52, 0, -0.66, 0.6, 1.18, -0.58, "frame"),
    ],
    muscles: { primary: ["chest", "triceps"], secondary: ["shoulders"] },
    tempo: { toEnd: 2, holdEnd: 0.3, toStart: 1.1, holdStart: 0.7 },
    adjust: { stance: true, grip: true },
    camera: 55,
  },
  {
    id: "ohp",
    name: "Overhead press",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.45, -1, 0.55) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, stance: 0.15, trunk: -2, handL: 0.25, handU: 0.02, handF: 0.15 } },
      { id: "mid", at: 0.45, pose: { ...STAND, stance: 0.15, trunk: -4, head: -10, handL: 0.26, handU: 0.27, handF: 0.17 } },
      { id: "end", at: 1, pose: { ...STAND, stance: 0.15, trunk: -2, handL: 0.27, handU: 0.52, handF: 0.02 } },
    ],
    verbs: { toEnd: "Press", toStart: "Lower" },
    tools: ["barbell", "dumbbells"],
    machine: [],
    muscles: { primary: ["shoulders", "triceps"], secondary: ["chest", "core"] },
    tempo: { toEnd: 1.1, holdEnd: 0.5, toStart: 1.8, holdStart: 0.5 },
    adjust: { stance: true, grip: true },
    camera: 60,
  },
  {
    id: "row",
    name: "Bent-over row",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.25, 0.25, -1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.8, pelvisZ: -0.22, trunk: 50, head: -22, stance: 0.14, handL: 0.24, handU: -0.4, handF: 0.42 } },
      { id: "end", at: 1, pose: { pelvisY: 0.8, pelvisZ: -0.22, trunk: 48, head: -22, stance: 0.14, handL: 0.25, handU: -0.22, handF: 0.12 } },
    ],
    verbs: { toEnd: "Row", toStart: "Lower" },
    tools: ["barbell", "dumbbells"],
    machine: [],
    muscles: { primary: ["back"], secondary: ["biceps", "shoulders", "hamstrings"] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.6, holdStart: 0.4 },
    adjust: { stance: true, grip: true },
    camera: 72,
  },
  {
    id: "pulldown",
    name: "Lat pulldown",
    rig: { legs: { mode: "angles" }, arms: { mode: "ik", pole: v3(0.75, -1, -0.25) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -12, hipL: 86, hipR: 86, kneeL: 88, kneeR: 88, hipAbd: 9, handL: 0.4, handU: 0.5, handF: 0.07 } },
      { id: "end", at: 1, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -18, hipL: 86, hipR: 86, kneeL: 88, kneeR: 88, hipAbd: 9, handL: 0.4, handU: 0.05, handF: 0.17 } },
    ],
    verbs: { toEnd: "Pull", toStart: "Return" },
    tools: ["latbar", "vhandle"],
    machine: [
      box(-0.2, 0.38, -0.18, 0.2, 0.47, 0.28, "pad", true),
      box(-0.05, 0, 0, 0.05, 0.38, 0.1, "steel", true),
      box(-0.36, 0, -0.66, 0.36, 0.04, 0.55, "frame", true),
      box(-0.07, 0, -0.66, 0.07, 2.38, -0.54, "frame"),
      box(-0.05, 2.3, -0.66, 0.05, 2.38, 0.16, "frame"),
      box(-0.22, 0.64, 0.22, 0.22, 0.72, 0.38, "pad"),
      box(-0.03, 0.47, 0.27, 0.03, 0.64, 0.33, "steel"),
    ],
    pulley: v3(0, 2.27, 0.12),
    muscles: { primary: ["back"], secondary: ["biceps", "shoulders"] },
    tempo: { toEnd: 1.1, holdEnd: 0.5, toStart: 1.7, holdStart: 0.4 },
    adjust: { stance: false, grip: true },
    camera: 50,
  },
  {
    id: "cablerow",
    name: "Seated cable row",
    rig: { legs: { mode: "planted", pole: v3(0.2, 1, 0.35) }, arms: { mode: "ik", pole: v3(0.15, -0.6, -1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.42, pelvisZ: 0, trunk: 18, stance: 0.12, footLZ: 0.7, footRZ: 0.7, footLY: 0.17, footRY: 0.17, footPitch: 70, handL: 0.07, handU: -0.13, handF: 0.55 } },
      { id: "end", at: 1, pose: { pelvisY: 0.42, pelvisZ: 0, trunk: -4, stance: 0.12, footLZ: 0.7, footRZ: 0.7, footLY: 0.17, footRY: 0.17, footPitch: 70, handL: 0.1, handU: -0.3, handF: 0.15 } },
    ],
    verbs: { toEnd: "Row", toStart: "Reach" },
    tools: ["vhandle", "latbar"],
    machine: [
      box(-0.18, 0.25, -0.38, 0.18, 0.33, 0.24, "pad", true),
      box(-0.1, 0, -0.42, 0.1, 0.25, 1.12, "frame", true),
      box(-0.26, 0.06, 0.8, 0.26, 0.46, 0.85, "steel", true),
      box(-0.13, 0, 1.12, 0.13, 1.32, 1.3, "frame"),
    ],
    pulley: v3(0, 0.4, 1.1),
    muscles: { primary: ["back"], secondary: ["biceps", "shoulders"] },
    tempo: { toEnd: 1, holdEnd: 0.6, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: false, grip: false },
    camera: 68,
  },
  {
    id: "curl",
    name: "Biceps curl",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, shFlex: 0, shAbd: 6, elbow: 8 } },
      { id: "end", at: 1, pose: { ...STAND, shFlex: 12, shAbd: 6, elbow: 140 } },
    ],
    verbs: { toEnd: "Curl", toStart: "Lower" },
    tools: ["dumbbells", "barbell"],
    machine: [],
    muscles: { primary: ["biceps"], secondary: ["forearms"] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.8, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 64,
  },
  {
    id: "pushdown",
    name: "Triceps pushdown",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, trunk: 12, shFlex: 6, shAbd: 4, elbow: 100 } },
      { id: "end", at: 1, pose: { ...STAND, trunk: 12, shFlex: 2, shAbd: 4, elbow: 6 } },
    ],
    verbs: { toEnd: "Push", toStart: "Return" },
    tools: ["shortbar", "vhandle"],
    machine: [box(-0.14, 0, 0.56, 0.14, 2.25, 0.74, "frame")],
    pulley: v3(0, 2.05, 0.53),
    muscles: { primary: ["triceps"], secondary: ["forearms"] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.5, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 64,
  },
  {
    id: "lateral",
    name: "Lateral raise",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, trunk: 4, shFlex: 8, shAbd: 10, elbow: 14 } },
      { id: "end", at: 1, pose: { ...STAND, trunk: 4, shFlex: 14, shAbd: 86, elbow: 14 } },
    ],
    verbs: { toEnd: "Raise", toStart: "Lower" },
    tools: ["dumbbells"],
    machine: [],
    muscles: { primary: ["shoulders"], secondary: [] },
    tempo: { toEnd: 1, holdEnd: 0.4, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 18,
  },
  {
    id: "legext",
    name: "Leg extension",
    rig: { legs: { mode: "angles" }, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -8, hipL: 88, hipR: 88, kneeL: 92, kneeR: 92, hipAbd: 6, footPitch: 10, shFlex: 14, shAbd: 26, elbow: 28 } },
      { id: "end", at: 1, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -8, hipL: 88, hipR: 88, kneeL: 6, kneeR: 6, hipAbd: 6, footPitch: 70, shFlex: 14, shAbd: 26, elbow: 28 } },
    ],
    verbs: { toEnd: "Extend", toStart: "Lower" },
    tools: ["roller"],
    machine: [
      box(-0.2, 0.38, -0.2, 0.2, 0.47, 0.32, "pad", true),
      box(-0.12, 0, -0.12, 0.12, 0.38, 0.2, "frame", true),
      box(-0.2, 0.47, -0.37, 0.2, 1.08, -0.27, "pad", true),
      box(-0.3, 0, -0.45, 0.3, 0.04, 0.35, "frame", true),
    ],
    muscles: { primary: ["quads"], secondary: [] },
    tempo: { toEnd: 1, holdEnd: 0.6, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: false, grip: false },
    camera: 72,
  },
  // ------------------------------------------------------------ added set
  {
    id: "hinge",
    name: "Romanian deadlift",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.2, 0, -1), frame: "world" } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.92, pelvisZ: 0, trunk: 0, head: 0, stance: 0.13, handL: 0.24, handU: 0.8, handF: 0.1 } },
      { id: "mid", at: 0.5, pose: { pelvisY: 0.9, pelvisZ: -0.14, trunk: 38, head: -6, stance: 0.13, handL: 0.24, handU: 0.68, handF: 0.1 } },
      { id: "end", at: 1, pose: { pelvisY: 0.86, pelvisZ: -0.28, trunk: 72, head: -14, stance: 0.13, handL: 0.24, handU: 0.46, handF: 0.09 } },
    ],
    verbs: { toEnd: "Hinge", toStart: "Stand" },
    tools: ["barbell", "dumbbells"],
    machine: [],
    muscles: { primary: ["hamstrings", "glutes"], secondary: ["back", "core", "forearms"] },
    tempo: { toEnd: 2, holdEnd: 0.4, toStart: 1.2, holdStart: 0.6 },
    adjust: { stance: true, grip: true },
    camera: 66,
  },
  {
    id: "goodmorning",
    name: "Good morning",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(0.5, -1, -0.4) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.92, pelvisZ: -0.02, trunk: 4, stance: 0.15, handL: 0.38, handU: -0.02, handF: -0.07 } },
      { id: "end", at: 1, pose: { pelvisY: 0.87, pelvisZ: -0.26, trunk: 74, head: -12, stance: 0.15, handL: 0.38, handU: -0.02, handF: -0.07 } },
    ],
    verbs: { toEnd: "Hinge", toStart: "Stand" },
    tools: ["barbell", "none"],
    machine: [],
    muscles: { primary: ["hamstrings", "glutes"], secondary: ["back", "core"] },
    tempo: { toEnd: 2, holdEnd: 0.4, toStart: 1.3, holdStart: 0.6 },
    adjust: { stance: true, grip: true },
    camera: 68,
  },
  {
    id: "calfraise",
    name: "Calf raise",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) }, tiptoe: ["L", "R"] },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, stance: 0.12, ...ARM_HANG } },
      { id: "end", at: 1, pose: { ...STAND, pelvisY: 0.99, stance: 0.12, footLY: 0.07, footRY: 0.07, ...ARM_HANG } },
    ],
    verbs: { toEnd: "Rise", toStart: "Lower" },
    tools: ["none", "dumbbells"],
    machine: [],
    muscles: { primary: ["calves"], secondary: ["core"] },
    tempo: { toEnd: 0.8, holdEnd: 0.6, toStart: 1.4, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 72,
  },
  {
    id: "frontraise",
    name: "Front raise",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, trunk: 2, shFlex: 4, shAbd: 6, elbow: 12 } },
      { id: "end", at: 1, pose: { ...STAND, trunk: 0, shFlex: 88, shAbd: 8, elbow: 12 } },
    ],
    verbs: { toEnd: "Raise", toStart: "Lower" },
    tools: ["dumbbells", "barbell"],
    machine: [],
    muscles: { primary: ["shoulders"], secondary: ["chest", "core"] },
    tempo: { toEnd: 1, holdEnd: 0.4, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 64,
  },
  {
    id: "uprightrow",
    name: "Upright row",
    rig: { legs: PLANTED, arms: { mode: "ik", pole: v3(1, 0.8, -0.1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, handL: 0.12, handU: -0.52, handF: 0.12 } },
      { id: "end", at: 1, pose: { ...STAND, handL: 0.12, handU: -0.1, handF: 0.12 } },
    ],
    verbs: { toEnd: "Pull", toStart: "Lower" },
    tools: ["barbell", "dumbbells"],
    machine: [],
    muscles: { primary: ["shoulders"], secondary: ["back", "biceps"] },
    tempo: { toEnd: 1, holdEnd: 0.4, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: true, grip: true },
    camera: 40,
  },
  {
    id: "reardelt",
    name: "Reverse fly",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.8, pelvisZ: -0.22, trunk: 50, head: -22, stance: 0.14, shFlex: 50, shAbd: 6, elbow: 16 } },
      { id: "end", at: 1, pose: { pelvisY: 0.8, pelvisZ: -0.22, trunk: 50, head: -22, stance: 0.14, shFlex: 8, shAbd: 82, elbow: 16 } },
    ],
    verbs: { toEnd: "Open", toStart: "Lower" },
    tools: ["dumbbells"],
    machine: [],
    muscles: { primary: ["shoulders", "back"], secondary: [] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.6, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 32,
  },
  {
    id: "flye",
    name: "Chest fly",
    rig: { legs: { mode: "planted", pole: v3(0.35, 1, 0.3) }, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { ...LYING, shFlex: 86, shAbd: 90, elbow: 14 } },
      { id: "end", at: 1, pose: { ...LYING, shFlex: 10, shAbd: 90, elbow: 24 } },
    ],
    verbs: { toEnd: "Open", toStart: "Squeeze" },
    tools: ["dumbbells"],
    machine: BENCH,
    muscles: { primary: ["chest"], secondary: ["shoulders"] },
    tempo: { toEnd: 2, holdEnd: 0.4, toStart: 1.4, holdStart: 0.5 },
    adjust: { stance: true, grip: false },
    camera: 40,
  },
  {
    id: "skullcrusher",
    name: "Lying triceps extension",
    rig: { legs: { mode: "planted", pole: v3(0.35, 1, 0.3) }, arms: { mode: "angles", hint: v3(0, 1, 0) } },
    keys: [
      { id: "start", at: 0, pose: { ...LYING, shFlex: 98, shAbd: 9, elbow: 6 } },
      { id: "end", at: 1, pose: { ...LYING, shFlex: 108, shAbd: 9, elbow: 118 } },
    ],
    verbs: { toEnd: "Lower", toStart: "Extend" },
    tools: ["barbell", "dumbbells"],
    machine: BENCH,
    muscles: { primary: ["triceps"], secondary: ["forearms"] },
    tempo: { toEnd: 1.8, holdEnd: 0.3, toStart: 1, holdStart: 0.5 },
    adjust: { stance: true, grip: false },
    camera: 62,
  },
  {
    id: "ohext",
    name: "Overhead triceps extension",
    rig: { legs: PLANTED, arms: { mode: "angles", hint: v3(0, 0, -1) } },
    keys: [
      { id: "start", at: 0, pose: { ...STAND, stance: 0.15, shFlex: 168, shAbd: 9, elbow: 8 } },
      { id: "end", at: 1, pose: { ...STAND, stance: 0.15, shFlex: 164, shAbd: 9, elbow: 132 } },
    ],
    verbs: { toEnd: "Lower", toStart: "Extend" },
    tools: ["dumbbells"],
    machine: [],
    muscles: { primary: ["triceps"], secondary: ["shoulders", "core"] },
    tempo: { toEnd: 1.8, holdEnd: 0.3, toStart: 1, holdStart: 0.5 },
    adjust: { stance: true, grip: false },
    camera: 70,
  },
  {
    id: "legcurl",
    name: "Seated leg curl",
    rig: { legs: { mode: "angles" }, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -8, hipL: 88, hipR: 88, kneeL: 8, kneeR: 8, hipAbd: 6, footPitch: 60, shFlex: 14, shAbd: 26, elbow: 28 } },
      { id: "end", at: 1, pose: { pelvisY: 0.55, pelvisZ: 0, trunk: -8, hipL: 88, hipR: 88, kneeL: 104, kneeR: 104, hipAbd: 6, footPitch: 0, shFlex: 14, shAbd: 26, elbow: 28 } },
    ],
    verbs: { toEnd: "Curl", toStart: "Return" },
    tools: ["roller"],
    machine: LEGEXT,
    muscles: { primary: ["hamstrings"], secondary: ["calves"] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.7, holdStart: 0.3 },
    adjust: { stance: false, grip: false },
    camera: 72,
  },
  {
    id: "pushup",
    name: "Push-up",
    rig: { legs: { mode: "planted", pole: v3(0.15, -1, 0.3) }, arms: { mode: "ik", pole: v3(0.8, -1, 0), frame: "world" }, tiptoe: ["L", "R"] },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.42, pelvisZ: -0.35, trunk: 68, head: 4, stance: 0.12, footLZ: -1.15, footRZ: -1.15, footLY: 0.018, footRY: 0.018, handL: 0.3, handU: 0.05, handF: 0.12 } },
      { id: "end", at: 1, pose: { pelvisY: 0.18, pelvisZ: -0.29, trunk: 84, head: 4, stance: 0.12, footLZ: -1.15, footRZ: -1.15, footLY: 0.018, footRY: 0.018, handL: 0.3, handU: 0.05, handF: 0.12 } },
    ],
    verbs: { toEnd: "Lower", toStart: "Push" },
    tools: ["none"],
    machine: MAT,
    muscles: { primary: ["chest", "triceps"], secondary: ["shoulders", "core"] },
    tempo: { toEnd: 1.4, holdEnd: 0.3, toStart: 0.9, holdStart: 0.4 },
    adjust: { stance: true, grip: true },
    camera: 52,
  },
  {
    id: "crunch",
    name: "Crunch",
    rig: { legs: { mode: "angles" }, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.1, pelvisZ: 0, trunk: -86, chest: -2, head: 0, hipL: 128, hipR: 128, kneeL: 82, kneeR: 82, hipAbd: 8, shFlex: 26, shAbd: 10, elbow: 8 } },
      { id: "end", at: 1, pose: { pelvisY: 0.1, pelvisZ: 0, trunk: -80, chest: 26, head: 14, hipL: 128, hipR: 128, kneeL: 82, kneeR: 82, hipAbd: 8, shFlex: 38, shAbd: 10, elbow: 8 } },
    ],
    verbs: { toEnd: "Curl up", toStart: "Lower" },
    tools: ["none"],
    machine: MAT,
    muscles: { primary: ["core"], secondary: [] },
    tempo: { toEnd: 1, holdEnd: 0.5, toStart: 1.4, holdStart: 0.3 },
    adjust: { stance: false, grip: false },
    camera: 78,
  },
  {
    id: "bridge",
    name: "Glute bridge",
    rig: { legs: { mode: "planted", pole: v3(0.2, 1, 0.4) }, arms: { mode: "angles", hint: v3(0, 0, 1) } },
    keys: [
      { id: "start", at: 0, pose: { pelvisY: 0.14, pelvisZ: 0, trunk: -95, head: 5, stance: 0.14, footLZ: 0.42, footRZ: 0.42, shFlex: -5, shAbd: 12, elbow: 6 } },
      { id: "end", at: 1, pose: { pelvisY: 0.4, pelvisZ: -0.1, trunk: -127, head: 37, stance: 0.14, footLZ: 0.42, footRZ: 0.42, shFlex: -37, shAbd: 12, elbow: 6 } },
    ],
    verbs: { toEnd: "Drive up", toStart: "Lower" },
    tools: ["none"],
    machine: MAT,
    muscles: { primary: ["glutes"], secondary: ["hamstrings", "core"] },
    tempo: { toEnd: 1, holdEnd: 0.8, toStart: 1.4, holdStart: 0.3 },
    adjust: { stance: true, grip: false },
    camera: 80,
  },
];

export const PATTERN = Object.fromEntries(PATTERNS.map((p) => [p.id, p])) as Record<string, Pattern>;
