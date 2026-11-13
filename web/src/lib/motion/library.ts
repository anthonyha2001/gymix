import { newDraft, type Draft } from "./motion";
import { PATTERN, type Tool } from "./patterns";

// The lab's starting library: common gym exercises built from the patterns.
// Test data only; nothing here is read by gyms.
const make = (pattern: string, name: string, tool?: Tool, extra: Partial<Draft> = {}): Draft => ({
  ...newDraft(PATTERN[pattern], name),
  ...(tool ? { tool } : {}),
  ...extra,
});

export function seedLibrary(): Draft[] {
  return [
    make("squat", "Barbell back squat"),
    make("squat", "Bodyweight squat", "none", { tweaks: { all: { handL: -0.26, handU: -0.1, handF: 0.55 } } }),
    make("deadlift", "Conventional deadlift"),
    make("lunge", "Dumbbell lunge"),
    make("lunge", "Bodyweight split squat", "none", { tweaks: { all: { shAbd: 20, elbow: 70, shFlex: 25 } } }),
    make("bench", "Barbell bench press"),
    make("bench", "Dumbbell bench press", "dumbbells", { grip: -0.05 }),
    make("ohp", "Overhead press"),
    make("row", "Barbell bent-over row"),
    make("pulldown", "Lat pulldown"),
    make("cablerow", "Seated cable row"),
    make("curl", "Dumbbell biceps curl"),
    make("curl", "Barbell curl", "barbell", { tweaks: { all: { shAbd: 2 } } }),
    make("pushdown", "Triceps pushdown"),
    make("lateral", "Dumbbell lateral raise"),
    make("legext", "Leg extension"),
  ];
}
