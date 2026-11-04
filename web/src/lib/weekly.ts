import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDays, todayIn } from "@/lib/format";
import type { WeekBar } from "@/components/weekly-chart";

type Client = Awaited<ReturnType<typeof createClient>>;

// Finished workouts per week (weeks start on Monday, in the gym's time zone).
export async function loadWeeklyBars(supabase: Client, memberId: string, timeZone: string, count = 8): Promise<WeekBar[]> {
  const today = todayIn(timeZone);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const thisMonday = addDays(today, -dow);
  const first = addDays(thisMonday, -7 * (count - 1));

  const { data } = await supabase
    .from("workout_sessions")
    .select("started_at, set_logs(weight_kg, reps)")
    .eq("member_id", memberId)
    .not("finished_at", "is", null)
    .gte("started_at", `${first}T00:00:00Z`);

  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone });
  const weeks: WeekBar[] = Array.from({ length: count }, (_, i) => {
    const weekStart = addDays(first, 7 * i);
    const label = new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return { weekStart, label, workouts: 0, volumeKg: 0 };
  });
  for (const s of data ?? []) {
    const day = dayOf.format(new Date(s.started_at));
    const i = Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / (7 * 86400_000));
    if (i < 0 || i >= count) continue;
    weeks[i].workouts += 1;
    weeks[i].volumeKg += s.set_logs.reduce((t, l) => t + Number(l.weight_kg) * l.reps, 0);
  }
  return weeks;
}
