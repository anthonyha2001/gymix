// Monthly challenges: what a challenge can count, and how to show it. Client-safe.
import { CalendarCheck, Dumbbell, Flame, Weight } from "lucide-react";

// Mirrors public.challenges.metric and member_challenges() in the database.

export const METRICS = {
  visits: { label: "Most visits", unit: "day", units: "days", verb: "Come to the gym", icon: Flame, hint: "Days at the gym (one per day)" },
  workouts: { label: "Most workouts", unit: "workout", units: "workouts", verb: "Finish workouts in the app", icon: Dumbbell, hint: "Finished workouts with logged sets" },
  volume: { label: "Most weight lifted", unit: "kg", units: "kg", verb: "Log your sets", icon: Weight, hint: "Weight × reps of every logged set" },
  classes: { label: "Most classes", unit: "class", units: "classes", verb: "Attend classes", icon: CalendarCheck, hint: "Classes attended" },
} as const;

export type Metric = keyof typeof METRICS;
export const isMetric = (m: string): m is Metric => m in METRICS;

export function formatScore(metric: string, score: number | null | undefined) {
  const n = Number(score ?? 0);
  const m = isMetric(metric) ? METRICS[metric] : null;
  if (!m) return n.toLocaleString("en-US");
  if (metric === "volume") return `${n.toLocaleString("en-US")} kg`;
  return `${n.toLocaleString("en-US")} ${n === 1 ? m.unit : m.units}`;
}

export type ChallengeTop = { rank: number; name: string; score: number; me: boolean };

export type MemberChallenge = {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number | null;
  prize: string | null;
  starts_on: string;
  ends_on: string;
  state: "upcoming" | "active" | "ended";
  days_left: number;
  status: "joined" | "skipped" | null;
  participants: number;
  score: number | null;
  rank: number | null;
  completed: boolean;
  top: ChallengeTop[];
};

