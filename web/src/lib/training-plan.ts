import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDays, todayIn } from "@/lib/format";
import { weekdayOf } from "@/lib/schedule";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PlanDay = { id: string; name: string; programId: string; programName: string; exercises: number };

export type TrainingPlan = {
  // Planned weekdays (0 = Sunday) and the program day each one is for.
  days: { weekday: number; programDayId: string | null }[];
  // Every day of the member's active programs, for choosing.
  programDays: PlanDay[];
  // What to train today: the planned day, or the next one not done this week.
  today: (PlanDay & { planned: boolean }) | null;
  isTrainingDay: boolean;
  doneThisWeek: number;
  goal: number;
  // Weeks in a row (ending last week or this one) with the goal reached.
  streak: number;
};

// Monday of the week of `date`.
function monday(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export async function loadTrainingPlan(supabase: Client, memberId: string, timeZone: string): Promise<TrainingPlan> {
  const today = todayIn(timeZone);
  const thisMonday = monday(today);
  const since = addDays(thisMonday, -7 * 11);

  const [{ data: days }, { data: programs }, { data: sessions }] = await Promise.all([
    supabase.from("member_training_days").select("weekday, program_day_id").eq("member_id", memberId).order("weekday"),
    supabase
      .from("programs")
      .select("id, name, updated_at, program_days(id, name, position, program_exercises(count))")
      .eq("member_id", memberId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("workout_sessions")
      .select("day_id, started_at")
      .eq("member_id", memberId)
      .not("finished_at", "is", null)
      .gte("started_at", `${since}T00:00:00Z`),
  ]);

  const programDays: PlanDay[] = (programs ?? []).flatMap((p) =>
    [...p.program_days]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({ id: d.id, name: d.name, programId: p.id, programName: p.name, exercises: d.program_exercises[0]?.count ?? 0 })),
  );

  // Finished workouts per week, and which program days are done this week.
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone });
  const perWeek = new Map<string, number>();
  const doneDays = new Set<string>();
  for (const s of sessions ?? []) {
    const week = monday(dayOf.format(new Date(s.started_at)));
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    if (week === thisMonday && s.day_id) doneDays.add(s.day_id);
  }

  const plan = (days ?? []).map((d) => ({ weekday: d.weekday, programDayId: d.program_day_id }));
  const goal = plan.length || 3;
  const doneThisWeek = perWeek.get(thisMonday) ?? 0;

  let streak = 0;
  // This week counts once it's reached; otherwise start from last week.
  for (let w = doneThisWeek >= goal ? thisMonday : addDays(thisMonday, -7); (perWeek.get(w) ?? 0) >= goal; w = addDays(w, -7)) streak++;

  const todayPlan = plan.find((d) => d.weekday === weekdayOf(today));
  const planned = programDays.find((d) => d.id === todayPlan?.programDayId);
  let pick: (PlanDay & { planned: boolean }) | null = null;
  if (planned && !doneDays.has(planned.id)) {
    pick = { ...planned, planned: true };
  } else {
    // The planned day is done (or none is set): the next day of that program,
    // or of the latest active one, that isn't done this week.
    const programId = planned?.programId ?? programDays[0]?.programId;
    const next = programDays.find((d) => d.programId === programId && !doneDays.has(d.id));
    if (next) pick = { ...next, planned: false };
  }

  return { days: plan, programDays, today: pick, isTrainingDay: Boolean(todayPlan), doneThisWeek, goal, streak };
}
