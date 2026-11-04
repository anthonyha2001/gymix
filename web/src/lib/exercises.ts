// Client-safe exercise library helpers.

import type { Database } from "@/lib/supabase/database.types";

export type Exercise = Pick<
  Database["public"]["Tables"]["exercises"]["Row"],
  "id" | "name" | "equipment" | "primary_muscles" | "image_paths"
> &
  Partial<Pick<Database["public"]["Tables"]["exercises"]["Row"], "secondary_muscles" | "instructions" | "level">>;

export type ProgramGoal = Database["public"]["Enums"]["program_goal"];
export type ExperienceLevel = Database["public"]["Enums"]["experience_level"];

// Exercise photos are stored as paths so the library can be re-hosted (or
// replaced with a licensed one) by changing this base URL only.
const IMAGE_BASE =
  process.env.NEXT_PUBLIC_EXERCISE_IMAGE_BASE ?? "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export function exerciseImageUrl(path: string) {
  return IMAGE_BASE + path;
}

// Public URL of a file in the gym-media storage bucket (e.g. a machine photo).
export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gym-media/${path}`;
}

export const MUSCLES = [
  "chest",
  "shoulders",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "middle back",
  "lower back",
  "traps",
  "abdominals",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
  "neck",
] as const;

export const EQUIPMENT = [
  "machine",
  "cable",
  "barbell",
  "dumbbell",
  "kettlebells",
  "e-z curl bar",
  "bands",
  "medicine ball",
  "exercise ball",
  "foam roll",
  "body only",
  "other",
] as const;

// Free equipment a gym can tick (machines are registered one by one instead).
// Values match exercises.equipment and public.set_gym_equipment().
export const FREE_EQUIPMENT: { value: string; label: string; hint: string }[] = [
  { value: "body only", label: "Bodyweight", hint: "Pull-ups, dips, push-ups, floor work" },
  { value: "dumbbell", label: "Dumbbells", hint: "Presses, rows, curls, lunges" },
  { value: "barbell", label: "Barbells & racks", hint: "Squats, deadlifts, bench press" },
  { value: "cable", label: "Cable station", hint: "Pulldowns, flyes, pushdowns" },
  { value: "kettlebells", label: "Kettlebells", hint: "Swings, goblet squats" },
  { value: "e-z curl bar", label: "EZ curl bar", hint: "Curls, skull crushers" },
  { value: "bands", label: "Resistance bands", hint: "Warm-ups, assisted work" },
  { value: "medicine ball", label: "Medicine balls", hint: "Throws, slams, core" },
  { value: "exercise ball", label: "Swiss ball", hint: "Core and stability" },
  { value: "foam roll", label: "Foam roller", hint: "Mobility and recovery" },
  { value: "other", label: "Other", hint: "Sleds, ropes, tires, landmine…" },
];

export function capitalize(text: string | null | undefined) {
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function musclesLabel(muscles: string[] | null | undefined) {
  return (muscles ?? []).map(capitalize).join(", ");
}

export const GOALS: { value: ProgramGoal; label: string }[] = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "strength", label: "Get stronger" },
  { value: "general_fitness", label: "General fitness" },
  { value: "rehab", label: "Rehab / injury recovery" },
];
export const GOAL_LABELS = Object.fromEntries(GOALS.map((g) => [g.value, g.label])) as Record<ProgramGoal, string>;

export const EXPERIENCE: { value: ExperienceLevel; label: string }[] = [
  { value: "beginner", label: "Beginner (under 6 months)" },
  { value: "intermediate", label: "Intermediate (6 months – 2 years)" },
  { value: "advanced", label: "Advanced (2+ years)" },
];
export const EXPERIENCE_LABELS = Object.fromEntries(EXPERIENCE.map((e) => [e.value, e.label.split(" (")[0]])) as Record<
  ExperienceLevel,
  string
>;

export function formatKg(kg: number | string | null | undefined) {
  const n = Number(kg ?? 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
}

export function formatRest(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min` : `${seconds}s`;
}
