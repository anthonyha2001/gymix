import "server-only";
import type { Tone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type Occupancy = {
  people: number;
  method: "sensor" | "doors" | "checkins";
  capacity: number | null;
  level: "quiet" | "moderate" | "busy" | "full";
  usualNow: number | null;
  entriesToday: number;
  exitsToday: number;
};

export const LEVELS: Record<Occupancy["level"], { label: string; tone: Tone }> = {
  quiet: { label: "Quiet", tone: "green" },
  moderate: { label: "Moderate", tone: "blue" },
  busy: { label: "Busy", tone: "amber" },
  full: { label: "Full", tone: "red" },
};

export const METHOD_TEXT: Record<Occupancy["method"], string> = {
  sensor: "Counted by your people counter.",
  doors: "From entries and exits at your doors.",
  checkins: "Estimated from check-ins within the usual visit length.",
};

// "almost nobody", "about 12 people": a usual number, honestly rounded.
export function usualText(n: number | null) {
  if (n === null) return null;
  if (n < 0.5) return "almost nobody";
  const r = Math.round(n);
  return `about ${r} ${r === 1 ? "person" : "people"}`;
}

// The current weekday (0 = Sunday) and hour in the gym's time zone.
export function gymClock(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
  return { weekday: Math.max(0, day), hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0) };
}

export async function loadOccupancy(gymId: string, withToday = false) {
  const supabase = await createClient();
  const [{ data: now }, { data: busy }, today] = await Promise.all([
    supabase.rpc("gym_occupancy", { p_gym_id: gymId }).maybeSingle(),
    supabase.rpc("gym_busy_hours", { p_gym_id: gymId }),
    withToday ? supabase.rpc("gym_occupancy_today", { p_gym_id: gymId }) : Promise.resolve({ data: [] }),
  ]);
  if (!now) return null;
  return {
    now: {
      people: now.people,
      method: now.method as Occupancy["method"],
      capacity: now.capacity,
      level: now.level as Occupancy["level"],
      usualNow: now.usual_now === null ? null : Number(now.usual_now),
      entriesToday: now.entries_today,
      exitsToday: now.exits_today,
    } satisfies Occupancy,
    busy: (busy ?? []).map((b) => ({ weekday: b.weekday, hour: b.hour, people: Number(b.people) })),
    today: (today.data ?? []) as { hour: number; people: number }[],
  };
}
