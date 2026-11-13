import { newDraft, type Draft } from "./motion";
import { PATTERN, type KeyId, type Muscle, type Tempo, type Tool } from "./patterns";
import type { Pose } from "./skeleton";

// The lab's starting library: real gym exercises built from the patterns,
// each one a pattern plus a tool, a stance or grip, a tempo, a range or a few
// pose changes. Test data only; nothing here is read by gyms.

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

// Tempo and range variants every pattern can take.
const paused = (name: string, hold = 1.6): Variant => ({ name: `Paused ${name}`, tempo: { holdEnd: hold } });
const slow = (name: string): Variant => ({ name: `Slow-eccentric ${name}`, tempo: { toEnd: 3.2 } });
const slowUp = (name: string): Variant => ({ name: `Slow-eccentric ${name}`, tempo: { toStart: 3.2 } });
const tempo = (name: string): Variant => ({ name: `Tempo ${name} (3-1-1)`, tempo: { toEnd: 3, holdEnd: 1, toStart: 1 } });

const LIBRARY: [string, Variant[]][] = [
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
      { name: "Box squat", range: 0.86, tempo: { holdEnd: 1 } },
      paused("back squat", 2),
      tempo("back squat"),
      slow("back squat"),
      { name: "Half squat", range: 0.55 },
      { name: "Quarter squat", range: 0.32 },
      { name: "Bodyweight squat", tool: "none", tweaks: { all: { handL: -0.26, handU: -0.1, handF: 0.55 } } },
      { name: "Prisoner squat", tool: "none", tweaks: { all: { handL: -0.24, handU: 0.14, handF: 0.02 } } },
      { name: "Paused bodyweight squat", tool: "none", tempo: { holdEnd: 2 }, tweaks: { all: { handL: -0.26, handU: -0.1, handF: 0.55 } } },
      { name: "Wide bodyweight squat", tool: "none", stance: 0.12, tweaks: { all: { handL: -0.26, handU: -0.1, handF: 0.55 } } },
      { name: "Goblet squat", tool: "dumbbells", lean: -10, tweaks: { all: { handL: -0.29, handU: -0.22, handF: 0.28 } } },
      { name: "Dumbbell squat", tool: "dumbbells", lean: -4, tweaks: { all: { handL: -0.14, handU: -0.53, handF: 0.12 } } },
      { name: "Dumbbell sumo squat", tool: "dumbbells", stance: 0.14, lean: -8, tweaks: { all: { handL: -0.32, handU: -0.5, handF: 0.12 } } },
    ],
  ],
  [
    "deadlift",
    [
      { name: "Conventional deadlift" },
      { name: "Sumo deadlift", stance: 0.2, grip: -0.08, tweaks: { start: { trunk: -14, pelvisY: -0.03 }, mid: { trunk: -10 } } },
      { name: "Snatch-grip deadlift", grip: 0.2, tweaks: { start: { pelvisY: -0.03 } } },
      { name: "Rack pull", tweaks: { start: { pelvisY: 0.14, pelvisZ: 0.12, trunk: -22, handU: 0.25 } } },
      { name: "Deadlift with lockout hold", tempo: { holdEnd: 2 } },
      slowUp("deadlift"),
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
      paused("Romanian deadlift"),
      tempo("Romanian deadlift"),
      { name: "Partial Romanian deadlift", range: 0.6 },
    ],
  ],
  [
    "goodmorning",
    [
      { name: "Barbell good morning" },
      { name: "Bodyweight good morning", tool: "none", tweaks: { all: { handL: -0.24, handU: 0.14, handF: 0.04 } } },
      { name: "Wide-stance good morning", stance: 0.12 },
      paused("good morning"),
      { name: "Partial good morning", range: 0.6 },
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
      paused("split squat", 1.5),
      tempo("split squat"),
      { name: "Partial split squat", range: 0.6 },
    ],
  ],
  [
    "bench",
    [
      { name: "Barbell bench press" },
      { name: "Close-grip bench press", grip: -0.16, primary: ["triceps", "chest"] },
      { name: "Wide-grip bench press", grip: 0.12 },
      { name: "Paused bench press", tempo: { holdEnd: 1.6 } },
      { name: "Spoto press", range: 0.86, tempo: { holdEnd: 1 } },
      { name: "Partial bench press", range: 0.55 },
      tempo("bench press"),
      slow("bench press"),
      { name: "Dumbbell bench press", tool: "dumbbells", grip: -0.05 },
      { name: "Neutral-grip dumbbell press", tool: "dumbbells", grip: -0.12 },
      { name: "Dumbbell squeeze press", tool: "dumbbells", grip: -0.3, primary: ["chest", "triceps"] },
      { name: "Paused dumbbell bench press", tool: "dumbbells", grip: -0.05, tempo: { holdEnd: 1.4 } },
    ],
  ],
  [
    "ohp",
    [
      { name: "Overhead press" },
      { name: "Wide-grip overhead press", grip: 0.1 },
      { name: "Close-grip overhead press", grip: -0.08, primary: ["triceps", "shoulders"] },
      { name: "Behind-the-neck press", tweaks: { all: { handF: -0.17 } } },
      paused("overhead press", 1.2),
      slowUp("overhead press"),
      { name: "Partial overhead press", range: 0.55 },
      { name: "Dumbbell shoulder press", tool: "dumbbells", grip: 0.05 },
      { name: "Neutral-grip dumbbell press (standing)", tool: "dumbbells", grip: -0.06 },
    ],
  ],
  [
    "row",
    [
      { name: "Barbell bent-over row" },
      { name: "Pendlay row", tempo: { toEnd: 0.6, holdStart: 0.8 }, tweaks: { all: { trunk: 30, pelvisY: -0.05 } } },
      { name: "Yates row", tweaks: { all: { trunk: -20 } } },
      { name: "Wide-grip barbell row", grip: 0.14, primary: ["back", "shoulders"] },
      { name: "Close-grip barbell row", grip: -0.08 },
      paused("barbell row", 1.4),
      slowUp("barbell row"),
      { name: "Dumbbell bent-over row", tool: "dumbbells", grip: 0.02 },
      { name: "Paused dumbbell row", tool: "dumbbells", grip: 0.02, tempo: { holdEnd: 1.4 } },
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
      paused("lat pulldown", 1.3),
      slowUp("lat pulldown"),
      { name: "Partial lat pulldown", range: 0.55 },
    ],
  ],
  [
    "cablerow",
    [
      { name: "Seated cable row" },
      { name: "Wide-grip cable row", tool: "latbar", tweaks: { all: { handL: 0.2 } }, primary: ["back", "shoulders"] },
      { name: "Strict cable row", tweaks: { start: { trunk: -14 } } },
      { name: "Stretch cable row", tweaks: { start: { trunk: 12 } } },
      paused("cable row", 1.4),
      slowUp("cable row"),
      { name: "Partial cable row", range: 0.6 },
    ],
  ],
  [
    "curl",
    [
      { name: "Dumbbell biceps curl" },
      { name: "Hammer curl", primary: ["biceps", "forearms"], secondary: [] },
      { name: "Barbell curl", tool: "barbell", tweaks: { all: { shAbd: 2 } } },
      { name: "Wide-grip barbell curl", tool: "barbell", tweaks: { all: { shAbd: 10 } } },
      { name: "Close-grip barbell curl", tool: "barbell", tweaks: { all: { shAbd: -4 } } },
      { name: "Drag curl", tool: "barbell", tweaks: { end: { shFlex: -32 } } },
      { name: "Bottom-half curl", range: 0.5 },
      { name: "Top-half curl", tweaks: { start: { elbow: 70, shFlex: 4 } } },
      paused("biceps curl", 1.4),
      slowUp("biceps curl"),
      tempo("biceps curl"),
      { name: "Wide dumbbell curl", tweaks: { all: { shAbd: 16 } } },
    ],
  ],
  [
    "pushdown",
    [
      { name: "Triceps pushdown" },
      { name: "V-bar pushdown", tool: "vhandle" },
      { name: "Lean-forward pushdown", tweaks: { all: { trunk: 12 } } },
      paused("pushdown", 1.2),
      slowUp("pushdown"),
      { name: "Partial pushdown", range: 0.6 },
      { name: "Upright pushdown", tweaks: { all: { trunk: -10 } } },
    ],
  ],
  [
    "lateral",
    [
      { name: "Dumbbell lateral raise" },
      { name: "Bent-arm lateral raise", tweaks: { all: { elbow: 50 } } },
      { name: "Scaption raise", tweaks: { end: { shFlex: 26 } } },
      { name: "Partial lateral raise", range: 0.6 },
      paused("lateral raise", 1.2),
      slowUp("lateral raise"),
      { name: "Lean-forward lateral raise", tweaks: { all: { trunk: 14 } }, primary: ["shoulders", "back"] },
    ],
  ],
  [
    "legext",
    [
      { name: "Leg extension" },
      { name: "Peak-hold leg extension", tempo: { holdEnd: 2 } },
      { name: "Bottom-half leg extension", range: 0.55 },
      slowUp("leg extension"),
      tempo("leg extension"),
    ],
  ],
  [
    "legcurl",
    [
      { name: "Seated leg curl" },
      { name: "Peak-hold leg curl", tempo: { holdEnd: 1.8 } },
      { name: "Partial leg curl", range: 0.55 },
      slowUp("leg curl"),
      tempo("leg curl"),
    ],
  ],
  [
    "calfraise",
    [
      { name: "Standing calf raise" },
      { name: "Dumbbell calf raise", tool: "dumbbells" },
      { name: "Paused calf raise", tempo: { holdEnd: 1.6 } },
      slowUp("calf raise"),
      { name: "Wide-stance calf raise", stance: 0.08 },
      { name: "Narrow-stance calf raise", stance: -0.05 },
      { name: "Bent-knee calf raise", tweaks: { all: { pelvisY: -0.06, trunk: 6 } } },
    ],
  ],
  [
    "frontraise",
    [
      { name: "Dumbbell front raise" },
      { name: "Barbell front raise", tool: "barbell", tweaks: { all: { shAbd: 2 } } },
      { name: "High front raise", tweaks: { end: { shFlex: 42 } } },
      { name: "Partial front raise", range: 0.6 },
      paused("front raise", 1.2),
    ],
  ],
  [
    "uprightrow",
    [
      { name: "Barbell upright row" },
      { name: "Dumbbell upright row", tool: "dumbbells", grip: 0.04 },
      { name: "Wide-grip upright row", grip: 0.12 },
      paused("upright row", 1.2),
      slowUp("upright row"),
    ],
  ],
  [
    "reardelt",
    [
      { name: "Bent-over reverse fly" },
      { name: "Bent-arm reverse fly", tweaks: { all: { elbow: 50 } } },
      paused("reverse fly", 1.2),
      slowUp("reverse fly"),
      { name: "Partial reverse fly", range: 0.6 },
    ],
  ],
  [
    "flye",
    [
      { name: "Dumbbell chest fly" },
      { name: "Bent-arm chest fly", tweaks: { all: { elbow: 36 } } },
      { name: "Top-range chest fly", range: 0.6 },
      paused("chest fly", 1.4),
      slow("chest fly"),
    ],
  ],
  [
    "skullcrusher",
    [
      { name: "Barbell skull crusher" },
      { name: "Dumbbell skull crusher", tool: "dumbbells" },
      { name: "Long-lever skull crusher", tweaks: { all: { shFlex: 20 } } },
      paused("skull crusher", 1.2),
      slow("skull crusher"),
    ],
  ],
  [
    "ohext",
    [
      { name: "Dumbbell overhead extension" },
      paused("overhead extension", 1.2),
      slow("overhead extension"),
      { name: "Partial overhead extension", range: 0.6 },
    ],
  ],
  [
    "pushup",
    [
      { name: "Push-up" },
      { name: "Wide push-up", grip: 0.14, primary: ["chest"] },
      { name: "Close-grip push-up", grip: -0.16, primary: ["triceps", "chest"] },
      paused("push-up", 1.5),
      slow("push-up"),
      tempo("push-up"),
      { name: "Partial push-up", range: 0.5 },
    ],
  ],
  [
    "crunch",
    [
      { name: "Crunch" },
      { name: "Sit-up", tweaks: { end: { trunk: 40, chest: -10 } }, secondary: ["quads"] },
      paused("crunch", 1.4),
      slowUp("crunch"),
    ],
  ],
  [
    "bridge",
    [
      { name: "Glute bridge" },
      { name: "Paused glute bridge", tempo: { holdEnd: 2 } },
      { name: "Wide-stance glute bridge", stance: 0.08 },
      { name: "Feet-close glute bridge", tweaks: { all: { footLZ: -0.07, footRZ: -0.07 } }, primary: ["glutes", "hamstrings"] },
      slowUp("glute bridge"),
    ],
  ],
];

export function seedLibrary(): Draft[] {
  const out: Draft[] = [];
  for (const [pattern, list] of LIBRARY) for (const v of list) out.push(make(pattern, v));
  return out;
}
