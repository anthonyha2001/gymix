import { newDraft, type Draft } from "./motion";
import { PATTERN, type KeyId, type Muscle, type Tempo, type Tool } from "./patterns";
import type { Pose } from "./skeleton";

// The lab's starting library: real gym exercises built from the patterns.
// Each base exercise is a pattern plus a tool, a stance or grip, a range or a
// few pose changes; most also come paused, with a slow eccentric and explosive.
// Test data only; nothing here is read by gyms.

type Variant = {
  name: string;
  tool?: Tool;
  stance?: number;
  grip?: number;
  lean?: number;
  range?: number;
  tempo?: Partial<Tempo>;
  tweaks?: Partial<Record<KeyId | "all", Pose>>;
  primary?: Muscle[];
  secondary?: Muscle[];
  // Already a timing or range variation: no protocol versions.
  only?: boolean;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function make(pattern: string, v: Variant): Draft {
  const base = newDraft(PATTERN[pattern], v.name);
  return {
    ...base,
    id: `seed-${slug(v.name)}`,
    tool: v.tool ?? base.tool,
    stance: v.stance ?? 0,
    grip: v.grip ?? 0,
    lean: v.lean ?? 0,
    range: v.range ?? 1,
    tempo: { ...base.tempo, ...v.tempo },
    tweaks: v.tweaks ?? {},
    primary: v.primary ?? base.primary,
    secondary: v.secondary ?? base.secondary,
  };
}

// Patterns whose move toward the end pose is the lowering (eccentric) phase.
const LOWER_FIRST = new Set([
  "squat", "lunge", "bench", "hinge", "goodmorning", "pushup", "flye", "skullcrusher", "ohext",
  "legpress", "dip", "smithsquat", "smithbench", "smithrdl", "smithsplit",
]);
// Names that keep their capital when a word goes in front of them.
const PROPER = /^(Romanian|Smith|Pendlay|Yates|Spoto|V-bar|EZ-bar)\b/;
const lead = (name: string) => (PROPER.test(name) ? name : name[0].toLowerCase() + name.slice(1));

// The standard training versions of a base exercise.
function protocols(pattern: string, v: Variant): Variant[] {
  const ecc: keyof Tempo = LOWER_FIRST.has(pattern) ? "toEnd" : "toStart";
  const con: keyof Tempo = ecc === "toEnd" ? "toStart" : "toEnd";
  const n = lead(v.name);
  const t = (x: Partial<Tempo>) => ({ ...v.tempo, ...x });
  return [
    { ...v, name: `Paused ${n}`, tempo: t({ holdEnd: 1.6 }) },
    { ...v, name: `Slow-eccentric ${n}`, tempo: t({ [ecc]: 3.2 }) },
    { ...v, name: `Explosive ${n}`, tempo: t({ [con]: 0.5, holdStart: 0.7 }) },
  ];
}

const BW_HANDS = { handL: -0.26, handU: -0.1, handF: 0.55 };
const PRISONER = { handL: -0.24, handU: 0.14, handF: 0.02 };

const LIBRARY: [string, Variant[]][] = [
  // ---------------------------------------------------------------- legs
  [
    "squat",
    [
      { name: "Barbell back squat" },
      { name: "High-bar back squat", lean: -8 },
      { name: "Low-bar back squat", lean: 8, tweaks: { all: { handL: 0.06, handU: -0.04 } } },
      { name: "Front squat", lean: -12, tweaks: { all: { handL: -0.12, handU: -0.02, handF: 0.22 } } },
      { name: "Overhead squat", lean: -10, tweaks: { all: { handL: 0.17, handU: 0.57, handF: 0.02 } }, secondary: ["shoulders", "core", "hamstrings"] },
      { name: "Wide-stance squat", stance: 0.12, tweaks: { all: { trunk: -4 } }, secondary: ["hamstrings", "core"] },
      { name: "Narrow-stance squat", stance: -0.05, lean: -4 },
      { name: "Box squat", range: 0.86, tempo: { holdEnd: 1 }, only: true },
      { name: "Half squat", range: 0.55, only: true },
      { name: "Quarter squat", range: 0.32, only: true },
      { name: "Bodyweight squat", tool: "none", tweaks: { all: BW_HANDS } },
      { name: "Prisoner squat", tool: "none", tweaks: { all: PRISONER } },
      { name: "Wide bodyweight squat", tool: "none", stance: 0.12, tweaks: { all: BW_HANDS } },
      { name: "Narrow bodyweight squat", tool: "none", stance: -0.05, tweaks: { all: BW_HANDS } },
      { name: "Goblet squat", tool: "dumbbells", lean: -10, tweaks: { all: { handL: -0.29, handU: -0.22, handF: 0.28 } } },
      { name: "Dumbbell squat", tool: "dumbbells", lean: -4, tweaks: { all: { handL: -0.14, handU: -0.53, handF: 0.12 } } },
      { name: "Dumbbell sumo squat", tool: "dumbbells", stance: 0.14, lean: -8, tweaks: { all: { handL: -0.32, handU: -0.5, handF: 0.12 } } },
    ],
  ],
  [
    "smithsquat",
    [
      { name: "Smith machine squat" },
      { name: "Smith machine wide-stance squat", stance: 0.12 },
      { name: "Smith machine narrow-stance squat", stance: -0.05 },
      { name: "Smith machine feet-forward squat", tweaks: { all: { footLZ: 0.16, footRZ: 0.16 } }, primary: ["quads", "glutes"] },
      { name: "Smith machine box squat", range: 0.86, tempo: { holdEnd: 1 }, only: true },
    ],
  ],
  [
    "legpress",
    [
      { name: "Leg press" },
      { name: "Wide-stance leg press", stance: 0.1, primary: ["glutes", "quads"] },
      { name: "Narrow-stance leg press", stance: -0.06, primary: ["quads"] },
      { name: "High-foot leg press", tweaks: { all: { footLY: 0.05, footRY: 0.05, footLZ: -0.05, footRZ: -0.05 } }, primary: ["glutes", "hamstrings"], secondary: ["quads"] },
      { name: "Low-foot leg press", tweaks: { all: { footLY: -0.05, footRY: -0.05, footLZ: 0.05, footRZ: 0.05 } }, primary: ["quads"] },
      { name: "Deep leg press", tweaks: { end: { footLY: -0.04, footRY: -0.04, footLZ: -0.04, footRZ: -0.04 } } },
    ],
  ],
  [
    "lunge",
    [
      { name: "Dumbbell split squat" },
      { name: "Bodyweight split squat", tool: "none", tweaks: { all: { shAbd: 20, elbow: 70, shFlex: 25 } } },
      { name: "Long-stride split squat", tweaks: { all: { footLZ: 0.07, footRZ: -0.08 } }, secondary: ["hamstrings", "glutes", "core"] },
      { name: "Short-stride split squat", tweaks: { all: { footLZ: -0.06, footRZ: 0.06 } } },
      { name: "Goblet split squat", tweaks: { all: { shFlex: 28, shAbd: 3, elbow: 122 } } },
      { name: "Overhead split squat", tweaks: { all: { shFlex: 166, shAbd: 4, elbow: -4 } }, secondary: ["shoulders", "core", "hamstrings"] },
      { name: "Torso-lean split squat", lean: 16, primary: ["glutes", "quads"] },
    ],
  ],
  [
    "smithsplit",
    [
      { name: "Smith machine split squat" },
      { name: "Smith machine long-stride split squat", tweaks: { all: { footLZ: 0.07, footRZ: -0.08 } }, primary: ["glutes", "quads"] },
    ],
  ],
  [
    "legext",
    [
      { name: "Leg extension" },
      { name: "Peak-hold leg extension", tempo: { holdEnd: 2 }, only: true },
      { name: "Bottom-half leg extension", range: 0.55, only: true },
    ],
  ],
  [
    "legcurl",
    [
      { name: "Seated leg curl" },
      { name: "Peak-hold seated leg curl", tempo: { holdEnd: 1.8 }, only: true },
    ],
  ],
  [
    "lyingcurl",
    [
      { name: "Lying leg curl" },
      { name: "Peak-hold lying leg curl", tempo: { holdEnd: 1.8 }, only: true },
    ],
  ],
  [
    "hipabd",
    [
      { name: "Hip abduction machine" },
      { name: "Lean-forward hip abduction", tweaks: { all: { trunk: 30 } } },
    ],
  ],
  [
    "hipadd",
    [
      { name: "Hip adduction machine" },
      { name: "Lean-forward hip adduction", tweaks: { all: { trunk: 26 } } },
    ],
  ],
  [
    "calfraise",
    [
      { name: "Standing calf raise" },
      { name: "Dumbbell calf raise", tool: "dumbbells" },
      { name: "Wide-stance calf raise", stance: 0.08 },
      { name: "Narrow-stance calf raise", stance: -0.05 },
      { name: "Bent-knee calf raise", tweaks: { all: { pelvisY: -0.06, trunk: 6 } } },
    ],
  ],
  [
    "seatedcalf",
    [
      { name: "Seated calf raise" },
      { name: "Wide-stance seated calf raise", stance: 0.06 },
      { name: "Narrow-stance seated calf raise", stance: -0.04 },
    ],
  ],
  // ---------------------------------------------------------------- hinge
  [
    "deadlift",
    [
      { name: "Conventional deadlift" },
      { name: "Sumo deadlift", stance: 0.2, grip: -0.08, tweaks: { start: { trunk: -14, pelvisY: -0.03 }, mid: { trunk: -10 } } },
      { name: "Snatch-grip deadlift", grip: 0.2, tweaks: { start: { pelvisY: -0.03 } } },
      { name: "Rack pull", tweaks: { start: { pelvisY: 0.14, pelvisZ: 0.12, trunk: -22, handU: 0.25 } } },
      { name: "Dumbbell deadlift", tool: "dumbbells", grip: 0.03 },
    ],
  ],
  [
    "hinge",
    [
      { name: "Romanian deadlift" },
      { name: "Dumbbell Romanian deadlift", tool: "dumbbells", grip: 0.02 },
      { name: "Stiff-leg deadlift", tweaks: { end: { pelvisY: 0.03, pelvisZ: 0.04, trunk: 4 }, mid: { pelvisY: 0.02 } } },
      { name: "Snatch-grip Romanian deadlift", grip: 0.2 },
      { name: "Wide-stance Romanian deadlift", stance: 0.1 },
    ],
  ],
  [
    "smithrdl",
    [
      { name: "Smith machine Romanian deadlift" },
      { name: "Smith machine stiff-leg deadlift", tweaks: { end: { pelvisY: 0.03, pelvisZ: 0.04, trunk: 4 } } },
    ],
  ],
  [
    "goodmorning",
    [
      { name: "Barbell good morning" },
      { name: "Bodyweight good morning", tool: "none", tweaks: { all: { ...PRISONER, handF: 0.04 } } },
      { name: "Wide-stance good morning", stance: 0.12 },
    ],
  ],
  [
    "backext",
    [
      { name: "Back extension" },
      { name: "Glute-focused back extension", tweaks: { all: { head: -10 } }, primary: ["glutes", "hamstrings"], secondary: ["back"] },
      { name: "Prisoner back extension", tweaks: { all: { shFlex: 110, shAbd: 40, elbow: 20 } } },
    ],
  ],
  [
    "bridge",
    [
      { name: "Glute bridge" },
      { name: "Wide-stance glute bridge", stance: 0.08 },
      { name: "Feet-close glute bridge", tweaks: { all: { footLZ: -0.07, footRZ: -0.07 } }, primary: ["glutes", "hamstrings"] },
    ],
  ],
  // ---------------------------------------------------------------- push
  [
    "bench",
    [
      { name: "Barbell bench press" },
      { name: "Close-grip bench press", grip: -0.16, primary: ["triceps", "chest"] },
      { name: "Wide-grip bench press", grip: 0.12 },
      { name: "Spoto press", range: 0.86, tempo: { holdEnd: 1 }, only: true },
      { name: "Dumbbell bench press", tool: "dumbbells", grip: -0.05 },
      { name: "Neutral-grip dumbbell press", tool: "dumbbells", grip: -0.12 },
      { name: "Dumbbell squeeze press", tool: "dumbbells", grip: -0.3, primary: ["chest", "triceps"] },
    ],
  ],
  [
    "smithbench",
    [
      { name: "Smith machine bench press" },
      { name: "Smith machine close-grip bench press", grip: -0.16, primary: ["triceps", "chest"] },
      { name: "Smith machine wide-grip bench press", grip: 0.12 },
    ],
  ],
  [
    "chestpress",
    [
      { name: "Machine chest press" },
      { name: "Wide-grip machine chest press", grip: 0.08 },
      { name: "Close-grip machine chest press", grip: -0.1, primary: ["triceps", "chest"] },
      { name: "Incline machine chest press", tweaks: { end: { handU: 0.14 } }, primary: ["chest", "shoulders"] },
      { name: "Decline machine chest press", tweaks: { end: { handU: -0.12 } } },
    ],
  ],
  [
    "flye",
    [
      { name: "Dumbbell chest fly" },
      { name: "Bent-arm chest fly", tweaks: { all: { elbow: 36 } } },
    ],
  ],
  [
    "pecdeck",
    [
      { name: "Pec deck" },
      { name: "Straight-arm pec deck", tweaks: { all: { elbow: -70 } } },
      { name: "Reverse pec deck", tweaks: { start: { shFlex: 66 }, end: { shFlex: -66 }, all: { elbow: -78 } }, primary: ["shoulders", "back"], secondary: [] },
    ],
  ],
  [
    "cablefly",
    [
      { name: "Cable crossover" },
      { name: "Wide-finish cable crossover", tweaks: { end: { shAbd: 12 } } },
      { name: "Cross-over squeeze", tweaks: { end: { shAbd: -8 } } },
      { name: "Upright cable crossover", tweaks: { all: { trunk: -12 } } },
    ],
  ],
  [
    "lowfly",
    [
      { name: "Low-to-high cable fly" },
      { name: "Bent-arm low cable fly", tweaks: { all: { elbow: 30 } } },
    ],
  ],
  [
    "pushup",
    [
      { name: "Push-up" },
      { name: "Wide push-up", grip: 0.14, primary: ["chest"] },
      { name: "Close-grip push-up", grip: -0.16, primary: ["triceps", "chest"] },
    ],
  ],
  [
    "dip",
    [
      { name: "Parallel-bar dip" },
      { name: "Upright triceps dip", tweaks: { all: { trunk: -10 } }, primary: ["triceps"], secondary: ["chest", "shoulders"] },
      { name: "Forward-lean chest dip", tweaks: { all: { trunk: 12 } }, primary: ["chest"], secondary: ["triceps", "shoulders"] },
      { name: "Straight-leg dip", tweaks: { all: { kneeL: -60, kneeR: -60, hipL: -10, hipR: -10 } } },
    ],
  ],
  [
    "ohp",
    [
      { name: "Overhead press" },
      { name: "Wide-grip overhead press", grip: 0.1 },
      { name: "Close-grip overhead press", grip: -0.08, primary: ["triceps", "shoulders"] },
      { name: "Behind-the-neck press", tweaks: { all: { handF: -0.17 } } },
      { name: "Dumbbell shoulder press", tool: "dumbbells", grip: 0.05 },
      { name: "Neutral-grip standing dumbbell press", tool: "dumbbells", grip: -0.06 },
    ],
  ],
  [
    "smithohp",
    [
      { name: "Smith machine overhead press" },
      { name: "Smith machine wide-grip press", grip: 0.1 },
    ],
  ],
  [
    "shoulderpress",
    [
      { name: "Machine shoulder press" },
      { name: "Wide-grip machine shoulder press", grip: 0.08 },
      { name: "Close-grip machine shoulder press", grip: -0.08, primary: ["shoulders", "triceps"] },
    ],
  ],
  [
    "lateral",
    [
      { name: "Dumbbell lateral raise" },
      { name: "Bent-arm lateral raise", tweaks: { all: { elbow: 50 } } },
      { name: "Scaption raise", tweaks: { end: { shFlex: 26 } } },
      { name: "Lean-forward lateral raise", tweaks: { all: { trunk: 14 } }, primary: ["shoulders", "back"] },
    ],
  ],
  [
    "cablelateral",
    [
      { name: "Cable lateral raise" },
      { name: "Cable Y-raise", tweaks: { end: { shFlex: 40 } } },
      { name: "Bent-arm cable lateral raise", tweaks: { all: { elbow: 50 } } },
    ],
  ],
  [
    "frontraise",
    [
      { name: "Dumbbell front raise" },
      { name: "Barbell front raise", tool: "barbell", tweaks: { all: { shAbd: 2 } } },
      { name: "High front raise", tweaks: { end: { shFlex: 42 } } },
    ],
  ],
  [
    "uprightrow",
    [
      { name: "Barbell upright row" },
      { name: "Dumbbell upright row", tool: "dumbbells", grip: 0.04 },
      { name: "Wide-grip upright row", grip: 0.12 },
    ],
  ],
  [
    "reardelt",
    [
      { name: "Bent-over reverse fly" },
      { name: "Bent-arm reverse fly", tweaks: { all: { elbow: 50 } } },
    ],
  ],
  [
    "facepull",
    [
      { name: "Face pull" },
      { name: "High face pull", tweaks: { end: { handU: 0.08 } } },
      { name: "Wide face pull", grip: 0.06 },
    ],
  ],
  // ---------------------------------------------------------------- pull
  [
    "row",
    [
      { name: "Barbell bent-over row" },
      { name: "Pendlay row", tempo: { toEnd: 0.6, holdStart: 0.8 }, tweaks: { all: { trunk: 30, pelvisY: -0.05 } } },
      { name: "Yates row", tweaks: { all: { trunk: -20 } } },
      { name: "Wide-grip barbell row", grip: 0.14, primary: ["back", "shoulders"] },
      { name: "Close-grip barbell row", grip: -0.08 },
      { name: "Dumbbell bent-over row", tool: "dumbbells", grip: 0.02 },
    ],
  ],
  [
    "smithrow",
    [
      { name: "Smith machine bent-over row" },
      { name: "Smith machine wide-grip row", grip: 0.14, primary: ["back", "shoulders"] },
    ],
  ],
  [
    "machinerow",
    [
      { name: "Chest-supported machine row" },
      { name: "Wide-grip machine row", grip: 0.12, primary: ["back", "shoulders"] },
      { name: "Close-grip machine row", grip: -0.1 },
      { name: "Machine high row", tweaks: { all: { handU: 0.12 } } },
      { name: "Machine low row", tweaks: { end: { handU: -0.08 } } },
    ],
  ],
  [
    "pulldown",
    [
      { name: "Lat pulldown" },
      { name: "Wide-grip lat pulldown", grip: 0.12 },
      { name: "Shoulder-width pulldown", grip: -0.12, primary: ["back", "biceps"] },
      { name: "Close-grip V-bar pulldown", tool: "vhandle", grip: -0.33 },
      { name: "Lean-back pulldown", lean: -12 },
    ],
  ],
  [
    "pullup",
    [
      { name: "Pull-up" },
      { name: "Wide-grip pull-up", grip: 0.14 },
      { name: "Chin-up", grip: -0.12, primary: ["back", "biceps"] },
      { name: "Close-grip pull-up", grip: -0.18 },
      { name: "Straight-leg pull-up", tweaks: { all: { kneeL: -40, kneeR: -40, hipL: -6, hipR: -6 } } },
      { name: "L-sit pull-up", tweaks: { all: { hipL: 78, hipR: 78, kneeL: -42, kneeR: -42 } }, secondary: ["core", "shoulders", "forearms"] },
      { name: "Scapular pull-up", range: 0.14, only: true },
      { name: "Negative pull-up", tempo: { toEnd: 0.4, toStart: 4 }, only: true },
    ],
  ],
  [
    "cablerow",
    [
      { name: "Seated cable row" },
      { name: "Wide-grip cable row", tool: "latbar", tweaks: { all: { handL: 0.2 } }, primary: ["back", "shoulders"] },
      { name: "Strict cable row", tweaks: { start: { trunk: -14 } } },
      { name: "Stretch cable row", tweaks: { start: { trunk: 12 } } },
    ],
  ],
  [
    "straightarm",
    [
      { name: "Straight-arm pulldown" },
      { name: "V-bar straight-arm pulldown", tool: "vhandle" },
      { name: "Upright straight-arm pulldown", tweaks: { all: { trunk: -14 } } },
    ],
  ],
  // ---------------------------------------------------------------- arms
  [
    "curl",
    [
      { name: "Dumbbell biceps curl" },
      { name: "Hammer curl", primary: ["biceps", "forearms"], secondary: [] },
      { name: "Barbell curl", tool: "barbell", tweaks: { all: { shAbd: 2 } } },
      { name: "Wide-grip barbell curl", tool: "barbell", tweaks: { all: { shAbd: 10 } } },
      { name: "Close-grip barbell curl", tool: "barbell", tweaks: { all: { shAbd: -4 } } },
      { name: "Drag curl", tool: "barbell", tweaks: { end: { shFlex: -32 } } },
      { name: "Wide dumbbell curl", tweaks: { all: { shAbd: 16 } } },
      { name: "Top-half curl", tweaks: { start: { elbow: 70, shFlex: 4 } }, only: true },
    ],
  ],
  [
    "cablecurl",
    [
      { name: "Cable curl" },
      { name: "V-bar cable curl", tool: "vhandle" },
      { name: "Wide-grip cable curl", tweaks: { all: { shAbd: 10 } } },
      { name: "Cable drag curl", tweaks: { end: { shFlex: -30 } } },
      { name: "Cable hammer curl", tool: "vhandle", primary: ["biceps", "forearms"] },
    ],
  ],
  [
    "preacher",
    [
      { name: "EZ-bar preacher curl" },
      { name: "Dumbbell preacher curl", tool: "dumbbells" },
      { name: "Wide-grip preacher curl", tweaks: { all: { shAbd: 10 } } },
      { name: "Close-grip preacher curl", tweaks: { all: { shAbd: -4 } } },
    ],
  ],
  [
    "pushdown",
    [
      { name: "Triceps pushdown" },
      { name: "V-bar pushdown", tool: "vhandle" },
      { name: "Lean-forward pushdown", tweaks: { all: { trunk: 12 } } },
      { name: "Upright pushdown", tweaks: { all: { trunk: -10 } } },
    ],
  ],
  [
    "skullcrusher",
    [
      { name: "Barbell skull crusher" },
      { name: "Dumbbell skull crusher", tool: "dumbbells" },
      { name: "Long-lever skull crusher", tweaks: { all: { shFlex: 20 } } },
    ],
  ],
  [
    "ohext",
    [
      { name: "Dumbbell overhead extension" },
      { name: "Wide-elbow overhead extension", tweaks: { all: { shAbd: 12 } } },
    ],
  ],
  // ---------------------------------------------------------------- core
  [
    "crunch",
    [
      { name: "Crunch" },
      { name: "Sit-up", tweaks: { end: { trunk: 40, chest: -10 } }, secondary: ["quads"] },
    ],
  ],
  [
    "kneeraise",
    [
      { name: "Hanging knee raise" },
      { name: "Hanging leg raise", tweaks: { end: { kneeL: -80, kneeR: -80, hipL: -10, hipR: -10 } }, secondary: ["forearms", "quads"] },
    ],
  ],
];

export function seedLibrary(): Draft[] {
  const out: Draft[] = [];
  const seen = new Set<string>();
  for (const [pattern, list] of LIBRARY) {
    for (const base of list) {
      for (const v of [base, ...(base.only ? [] : protocols(pattern, base))]) {
        const d = make(pattern, v);
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push(d);
      }
    }
  }
  return out;
}
