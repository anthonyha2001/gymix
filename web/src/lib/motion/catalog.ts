import { seedLibrary } from "./library";
import type { Draft } from "./motion";
import { PATTERN, type Muscle } from "./patterns";

// The Gymix motion library as rows of the app's `exercises` catalog. The
// rows are written by a migration (scripts/motion-catalog.ts); each one points
// at its motion through image_paths = ["motion:<draft id>"], which
// ExerciseAnimation plays instead of photos.

export { MOTION_PREFIX } from "@/lib/exercises";
import { MOTION_PREFIX } from "@/lib/exercises";

// How to do each movement, in plain steps.
const CUES: Record<string, string[]> = {
  squat: [
    "Set the bar across your upper back and stand with your feet about shoulder-width apart.",
    "Brace your core, then sit down and back, knees tracking over your toes.",
    "Go as low as you can with a neutral spine, then drive up through your whole foot.",
  ],
  smithsquat: [
    "Set the Smith bar across your upper back, unhook it and place your feet slightly in front of the bar.",
    "Brace, then bend your knees and hips to lower under control.",
    "Drive up through your whole foot and re-hook the bar when you finish.",
  ],
  legpress: [
    "Sit with your back flat against the pad and your feet hip-width on the platform.",
    "Release the safeties and lower the sled until your knees reach about 90 degrees.",
    "Press the platform away without locking your knees hard, and keep your lower back on the pad.",
  ],
  lunge: [
    "Take a long split stance: front foot flat, back heel up.",
    "Lower straight down until your back knee is just above the floor.",
    "Drive through your front foot to stand back up, keeping your torso tall.",
  ],
  smithsplit: [
    "Set the Smith bar on your upper back and step into a split stance.",
    "Lower straight down until your back knee nearly touches the floor.",
    "Drive through your front foot to rise, then re-hook the bar after your set.",
  ],
  legext: [
    "Sit with your knees lined up with the machine's pivot and the pad on your lower shins.",
    "Straighten your legs until your quads are fully contracted.",
    "Lower slowly without letting the weight stack touch down.",
  ],
  legcurl: [
    "Sit with your knees at the pivot and the pad just above your heels.",
    "Curl your heels down and back as far as you can.",
    "Return slowly to straight legs.",
  ],
  lyingcurl: [
    "Lie face down with your knees just off the pad and the roller above your heels.",
    "Curl your heels toward your glutes, keeping your hips down on the pad.",
    "Lower under control to straight legs.",
  ],
  hipabd: [
    "Sit tall with your back on the pad and the pads on the outside of your knees.",
    "Push your knees apart as far as you can.",
    "Bring them back together slowly.",
  ],
  hipadd: [
    "Sit tall with your back on the pad and the pads on the inside of your knees.",
    "Squeeze your knees together.",
    "Let them open again slowly to a comfortable stretch.",
  ],
  calfraise: [
    "Stand tall with your feet hip-width apart.",
    "Rise onto the balls of your feet as high as you can.",
    "Lower your heels slowly back to the floor.",
  ],
  seatedcalf: [
    "Sit with the pad on your lower thighs and the balls of your feet on the platform.",
    "Push up onto your toes as high as you can.",
    "Lower your heels slowly for a full stretch.",
  ],
  deadlift: [
    "Stand with the bar over your mid-foot and grip it just outside your legs.",
    "Brace your back flat, then push the floor away to stand up with the bar close to your legs.",
    "Lock out with your hips, then lower the bar the same way.",
  ],
  hinge: [
    "Stand tall holding the weight in front of your thighs, knees slightly bent.",
    "Push your hips back and let the weight slide down your legs, back flat.",
    "Stop when you feel a strong hamstring stretch, then squeeze your glutes to stand.",
  ],
  smithrdl: [
    "Stand in the Smith machine holding the bar in front of your thighs.",
    "Push your hips back, back flat, and let the bar travel down your legs.",
    "Squeeze your glutes to return to standing.",
  ],
  goodmorning: [
    "Rest the bar on your upper back and stand with soft knees.",
    "Push your hips back and lower your chest toward parallel with a flat back.",
    "Squeeze your glutes to bring your torso back up.",
  ],
  backext: [
    "Set the pad just below your hips and lock your heels under the roller.",
    "Lower your torso slowly, keeping your back neutral.",
    "Raise up until your body is in a straight line, without arching past it.",
  ],
  bridge: [
    "Lie on your back with your knees bent and feet flat on the floor.",
    "Drive through your heels to lift your hips until your body is straight from knees to shoulders.",
    "Squeeze your glutes at the top, then lower slowly.",
  ],
  bench: [
    "Lie on the bench with your eyes under the bar and your feet planted.",
    "Lower the weight to your mid-chest with your elbows slightly tucked.",
    "Press back up to straight arms, keeping your shoulder blades pinned.",
  ],
  smithbench: [
    "Lie on the bench so the Smith bar lines up with your mid-chest.",
    "Unhook the bar and lower it to your chest with control.",
    "Press up to straight arms, then re-hook the bar after the set.",
  ],
  chestpress: [
    "Set the seat so the handles line up with your mid-chest.",
    "Press the handles forward until your arms are straight.",
    "Return slowly until you feel a stretch across your chest.",
  ],
  flye: [
    "Lie on the bench holding the weights above your chest, elbows slightly bent.",
    "Open your arms wide in an arc until you feel a chest stretch.",
    "Bring the weights back together over your chest along the same arc.",
  ],
  pecdeck: [
    "Sit tall with your back on the pad and your forearms against the arm pads.",
    "Bring the pads together in front of your chest.",
    "Let them open slowly until your elbows line up with your shoulders.",
  ],
  cablefly: [
    "Set the pulleys high, take a handle in each hand and step forward into a staggered stance.",
    "With a slight bend in your elbows, bring your hands together down in front of you.",
    "Let your arms open slowly back to the start.",
  ],
  lowfly: [
    "Set the pulleys low, take a handle in each hand and step forward.",
    "Sweep your hands up and together to chin height.",
    "Lower them slowly back to your sides.",
  ],
  pushup: [
    "Set your hands just wider than your shoulders and your body in a straight line.",
    "Lower your chest toward the floor, elbows at about 45 degrees.",
    "Push the floor away to straight arms, keeping your hips in line.",
  ],
  dip: [
    "Support yourself on the bars with straight arms.",
    "Lower by bending your elbows until your upper arms are about parallel to the floor.",
    "Press back up to straight arms.",
  ],
  ohp: [
    "Hold the weight at your shoulders and stand with your glutes and core tight.",
    "Press straight overhead, moving your head back slightly to clear the path.",
    "Finish with the weight over your mid-foot, then lower it to your shoulders.",
  ],
  smithohp: [
    "Stand under the Smith bar with it at shoulder height and unhook it.",
    "Press overhead to straight arms.",
    "Lower it back to your shoulders with control.",
  ],
  shoulderpress: [
    "Set the seat so the handles start at shoulder height.",
    "Press the handles overhead until your arms are straight.",
    "Lower them slowly back to shoulder height.",
  ],
  lateral: [
    "Stand tall with the weights at your sides, elbows slightly bent.",
    "Raise your arms out to the sides until they reach shoulder height.",
    "Lower them slowly.",
  ],
  cablelateral: [
    "Stand between the low pulleys holding each handle across your body.",
    "Raise your arms out to the sides to shoulder height.",
    "Lower slowly, keeping tension on the cables.",
  ],
  frontraise: [
    "Stand tall with the weights in front of your thighs.",
    "Raise them straight in front of you to shoulder height.",
    "Lower slowly without swinging.",
  ],
  uprightrow: [
    "Hold the weight in front of your thighs with a narrow grip.",
    "Pull it up along your body, leading with your elbows, to chest height.",
    "Lower it slowly.",
  ],
  reardelt: [
    "Hinge forward with a flat back, weights hanging under your chest.",
    "Raise your arms out to the sides, squeezing your shoulder blades.",
    "Lower slowly.",
  ],
  facepull: [
    "Set the pulley at head height and hold the rope with your arms straight.",
    "Pull the rope toward your face, elbows high and wide.",
    "Return slowly to straight arms.",
  ],
  row: [
    "Hinge forward with a flat back, holding the weight at arm's length.",
    "Row it to your lower ribs, squeezing your shoulder blades together.",
    "Lower it under control.",
  ],
  smithrow: [
    "Hinge forward under the Smith bar and hold it at arm's length.",
    "Row the bar to your lower ribs.",
    "Lower it slowly, keeping your back flat.",
  ],
  machinerow: [
    "Sit with your chest against the pad and hold the handles at arm's length.",
    "Pull the handles back, driving your elbows behind you.",
    "Return slowly to straight arms.",
  ],
  pulldown: [
    "Sit with your thighs under the pads and hold the bar wider than your shoulders.",
    "Pull the bar to your upper chest, driving your elbows down.",
    "Let it rise slowly until your arms are straight.",
  ],
  pullup: [
    "Hang from the bar with your hands just wider than your shoulders.",
    "Pull yourself up until your chin clears the bar.",
    "Lower slowly to a full hang.",
  ],
  cablerow: [
    "Sit with your feet on the platform, knees soft, holding the handle.",
    "Row the handle to your stomach, chest up and shoulders back.",
    "Reach forward slowly until your arms are straight.",
  ],
  straightarm: [
    "Face the high pulley, hinge slightly and hold the bar with straight arms.",
    "Sweep the bar down to your thighs, keeping your arms straight.",
    "Let it rise slowly back to eye level.",
  ],
  curl: [
    "Stand tall with the weights at your sides, elbows by your ribs.",
    "Curl the weights up toward your shoulders without moving your elbows forward.",
    "Lower them slowly to straight arms.",
  ],
  cablecurl: [
    "Face the low pulley and hold the handle with your arms straight.",
    "Curl it up toward your shoulders, elbows fixed at your sides.",
    "Lower slowly to straight arms.",
  ],
  preacher: [
    "Sit with the backs of your upper arms flat on the pad.",
    "Curl the weight up toward your shoulders.",
    "Lower it slowly until your arms are nearly straight.",
  ],
  pushdown: [
    "Face the high pulley, elbows tucked at your sides.",
    "Push the handle down until your arms are straight.",
    "Let it rise slowly to about chest height.",
  ],
  skullcrusher: [
    "Lie on the bench holding the weight above your chest with straight arms.",
    "Bend your elbows to lower it toward your forehead, upper arms still.",
    "Straighten your arms to press it back up.",
  ],
  ohext: [
    "Hold the weight overhead with straight arms.",
    "Bend your elbows to lower it behind your head, elbows pointing up.",
    "Straighten your arms to lift it back overhead.",
  ],
  crunch: [
    "Lie on your back with your knees bent and feet flat.",
    "Curl your shoulders off the floor by tightening your abs.",
    "Lower slowly without letting your head drop.",
  ],
  kneeraise: [
    "Hang from the bar with straight arms.",
    "Bring your knees up toward your chest without swinging.",
    "Lower your legs slowly.",
  ],
};

const MUSCLE_NAME: Record<Muscle, string> = {
  chest: "chest",
  back: "lats",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  core: "abdominals",
  glutes: "glutes",
  quads: "quadriceps",
  hamstrings: "hamstrings",
  calves: "calves",
};
// Which part of the back each pattern works.
const BACK: Record<string, string> = {
  row: "middle back", cablerow: "middle back", machinerow: "middle back", smithrow: "middle back",
  reardelt: "middle back", facepull: "middle back", uprightrow: "traps",
  deadlift: "lower back", hinge: "lower back", smithrdl: "lower back", goodmorning: "lower back", backext: "lower back",
};
const PULL = new Set([
  "deadlift", "hinge", "smithrdl", "goodmorning", "backext", "row", "smithrow", "machinerow", "cablerow", "pulldown", "pullup",
  "straightarm", "facepull", "reardelt", "uprightrow", "curl", "cablecurl", "preacher", "legcurl", "lyingcurl", "kneeraise", "crunch", "hipadd",
]);
const ISOLATION = new Set([
  "curl", "cablecurl", "preacher", "pushdown", "skullcrusher", "ohext", "lateral", "cablelateral", "frontraise", "reardelt", "flye",
  "pecdeck", "cablefly", "lowfly", "legext", "legcurl", "lyingcurl", "calfraise", "seatedcalf", "hipabd", "hipadd", "crunch",
  "straightarm", "kneeraise", "facepull",
]);
const EXPERT = /Overhead squat|Snatch-grip|L-sit|Pendlay|Behind-the-neck|Overhead split|Sumo deadlift/;

function muscles(d: Draft, list: Muscle[]) {
  const out = list.map((m) => (m === "back" ? BACK[d.pattern] ?? "lats" : MUSCLE_NAME[m]));
  if (d.pattern === "hipabd" && list === d.primary) out.unshift("abductors");
  if (d.pattern === "hipadd" && list === d.primary) return ["adductors"];
  return [...new Set(out)];
}

function equipment(d: Draft) {
  const p = PATTERN[d.pattern];
  if (p.equip === "machine" || p.equip === "smith") return d.pattern === "preacher" ? (d.tool === "dumbbells" ? "dumbbell" : "e-z curl bar") : "machine";
  if (p.equip === "cable") return "cable";
  if (p.equip === "tower") return "other";
  if (d.tool === "barbell") return "barbell";
  if (d.tool === "dumbbells") return "dumbbell";
  if (d.tool === "none") return "body only";
  return "other";
}

function level(d: Draft) {
  if (EXPERT.test(d.name)) return "expert";
  const p = PATTERN[d.pattern];
  const easy = p.equip === "machine" || p.equip === "cable" || p.equip === "smith" || d.tool === "none";
  return easy && !d.name.startsWith("Explosive") ? "beginner" : "intermediate";
}

function steps(d: Draft) {
  const out = [...(CUES[d.pattern] ?? [])];
  const p = PATTERN[d.pattern];
  if (d.grip > 0.04) out.push("Take a wider grip than usual.");
  if (d.grip < -0.04) out.push("Take a narrower grip than usual.");
  if (d.stance > 0.04) out.push("Set your feet wider than usual.");
  if (d.stance < -0.03) out.push("Keep your feet closer together than usual.");
  if (d.range < 0.7) out.push("Work only the first part of the range, then return.");
  if (d.name.startsWith("Paused ")) out.push("Pause for 1 to 2 seconds at the end of every rep before you return.");
  if (d.name.startsWith("Slow-eccentric ")) out.push("Take a full 3 seconds on the lowering part of every rep.");
  if (d.name.startsWith("Explosive ")) out.push(`${p.verbs.toEnd === "Lower" ? p.verbs.toStart : p.verbs.toEnd} as fast as you can, then control the way back.`);
  return out;
}

export type CatalogRow = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  level: string;
  force: string;
  mechanic: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  image_paths: string[];
  source: string;
};

export function catalogRows(): CatalogRow[] {
  return seedLibrary().map((d) => ({
    id: d.id.replace(/^seed-/, "gx-"),
    name: d.name,
    category: "strength",
    equipment: equipment(d),
    level: level(d),
    force: PULL.has(d.pattern) ? "pull" : "push",
    mechanic: ISOLATION.has(d.pattern) ? "isolation" : "compound",
    primary_muscles: muscles(d, d.primary),
    secondary_muscles: muscles(d, d.secondary).filter((m) => !muscles(d, d.primary).includes(m)),
    instructions: steps(d),
    image_paths: [MOTION_PREFIX + d.id],
    source: "gymix-motion",
  }));
}
