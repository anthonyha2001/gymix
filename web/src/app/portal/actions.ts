"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { kickAccess } from "@/lib/access/server";
import { GOALS, EXPERIENCE, type ExperienceLevel, type ProgramGoal } from "@/lib/exercises";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { hoursAgoIso } from "@/lib/format";
import { deleteSet, finishSession, saveSet } from "@/lib/workout-sets";

async function myMember() {
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("gym_id", membership.gymId)
    .eq("user_id", viewer.id)
    .maybeSingle();
  return { supabase, viewer, membership, memberId: data?.id ?? null };
}

export async function requestProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, membership } = await myMember();
  const goal = text(formData, "goal") as ProgramGoal;
  const experience = text(formData, "experience") as ExperienceLevel;
  const days = Number(text(formData, "days_per_week"));
  if (!GOALS.some((g) => g.value === goal)) return { error: "Choose your goal." };
  if (!EXPERIENCE.some((e) => e.value === experience)) return { error: "Choose your experience." };
  if (!Number.isInteger(days) || days < 1 || days > 7) return { error: "How many days a week can you train?" };

  const { error } = await supabase.rpc("request_program", {
    p_gym_id: membership.gymId,
    p_goal: goal,
    p_days_per_week: days,
    p_experience: experience,
    p_injuries: text(formData, "injuries") || undefined,
    p_notes: text(formData, "notes") || undefined,
    p_preferred_trainer_id: text(formData, "trainer_id") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't send your request.") };
  refresh();
  return { success: "Request sent. A trainer will build your program." };
}

export async function cancelMyRequest(requestId: string): Promise<ActionState> {
  const { supabase } = await myMember();
  const { error } = await supabase.rpc("cancel_program_request", { p_request_id: requestId });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Request cancelled." };
}

export async function createSelfProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, viewer, membership, memberId } = await myMember();
  if (!memberId) return { error: "Your account isn't linked to a membership yet. Ask the front desk." };
  const { data, error } = await supabase
    .from("programs")
    .insert({
      gym_id: membership.gymId,
      member_id: memberId,
      name: text(formData, "name") || "My program",
      kind: "self",
      is_active: true,
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (error) return { error: errorMessage(error, "Couldn't create the program.") };
  await supabase.from("program_days").insert({ program_id: data.id, position: 1, name: "Day 1" });
  // Straight into the builder, as a dialog on the programs page.
  redirect(`/portal/programs?edit=${data.id}`);
}

// The member's unfinished workout from the last 12 hours, if any.
async function openSession(supabase: Awaited<ReturnType<typeof createClient>>, memberId: string) {
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, day_id")
    .eq("member_id", memberId)
    .is("finished_at", null)
    .gte("started_at", hoursAgoIso(12))
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Starts a workout from a program day: the day's exercises become the workout's list.
export async function startWorkout(programId: string, dayId: string, dayName: string) {
  const { supabase, membership, memberId } = await myMember();
  if (!memberId) redirect("/portal");

  // Carry on with an unfinished workout of the same day rather than starting a duplicate.
  const open = await openSession(supabase, memberId);
  if (open?.day_id === dayId) redirect(`/portal/workout/${open.id}`);

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ gym_id: membership.gymId, member_id: memberId, program_id: programId, day_id: dayId, day_name: dayName })
    .select("id")
    .single();
  if (error || !data) redirect("/portal/train");

  const { data: dayExercises } = await supabase
    .from("program_exercises")
    .select("id, exercise_id, position")
    .eq("day_id", dayId)
    .order("position");
  const seen = new Set<string>();
  const rows = (dayExercises ?? [])
    .filter((e) => !seen.has(e.exercise_id) && seen.add(e.exercise_id))
    .map((e, i) => ({
      session_id: data.id,
      member_id: memberId,
      exercise_id: e.exercise_id,
      position: i + 1,
      program_exercise_id: e.id,
      added_via: "program",
    }));
  if (rows.length) await supabase.from("workout_exercises").insert(rows);
  redirect(`/portal/workout/${data.id}`);
}

// Starts (or resumes) a workout without a program: exercises are added by hand
// or by tapping machines.
export async function startFreeWorkout() {
  const { supabase, membership, memberId } = await myMember();
  if (!memberId) redirect("/portal");
  const open = await openSession(supabase, memberId);
  if (open && !open.day_id) redirect(`/portal/workout/${open.id}`);
  const { data } = await supabase
    .from("workout_sessions")
    .insert({ gym_id: membership.gymId, member_id: memberId, day_name: "Free workout" })
    .select("id")
    .single();
  redirect(data ? `/portal/workout/${data.id}` : "/portal/train");
}

async function insertWorkoutExercise(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  memberId: string,
  exerciseId: string,
  machineId?: string,
) {
  const { count } = await supabase.from("workout_exercises").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  const { error } = await supabase.from("workout_exercises").insert({
    session_id: sessionId,
    member_id: memberId,
    exercise_id: exerciseId,
    position: (count ?? 0) + 1,
    machine_id: machineId ?? null,
    added_via: machineId ? "machine" : "manual",
  });
  // Already in this workout: nothing to do.
  return error && error.code !== "23505" ? errorMessage(error, "Couldn't add the exercise.") : null;
}

export async function addWorkoutExercise(sessionId: string, exerciseId: string): Promise<ActionState> {
  const { supabase, memberId } = await myMember();
  if (!memberId) return { error: "Not linked to a membership." };
  const err = await insertWorkoutExercise(supabase, sessionId, memberId, exerciseId);
  if (err) return { error: err };
  refresh();
  return { success: "Exercise added." };
}

export async function removeWorkoutExercise(workoutExerciseId: string, sessionId: string, exerciseId: string): Promise<ActionState> {
  const { supabase } = await myMember();
  const { count } = await supabase
    .from("set_logs")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);
  if (count) return { error: "Undo its logged sets first." };
  await supabase.from("workout_exercises").delete().eq("id", workoutExerciseId);
  refresh();
  return { success: "Exercise removed." };
}

// "Tap the machine to record training": adds the machine's exercise to the
// current workout (starting a free workout if none is open).
export async function recordOnMachine(machineId: string, exerciseId: string) {
  const { supabase, membership, memberId } = await myMember();
  if (!memberId) redirect("/portal");
  let sessionId = (await openSession(supabase, memberId))?.id;
  if (!sessionId) {
    const { data } = await supabase
      .from("workout_sessions")
      .insert({ gym_id: membership.gymId, member_id: memberId, day_name: "Free workout" })
      .select("id")
      .single();
    sessionId = data?.id;
  }
  if (!sessionId) redirect("/portal/train");
  await insertWorkoutExercise(supabase, sessionId, memberId, exerciseId, machineId);
  redirect(`/portal/workout/${sessionId}`);
}

export type SetResult = { ok: boolean; pr: boolean; error?: string };

export async function logSet(
  sessionId: string,
  exerciseId: string,
  setNumber: number,
  weightKg: number,
  reps: number,
): Promise<SetResult> {
  const { supabase, memberId } = await myMember();
  if (!memberId) return { ok: false, pr: false, error: "Not linked to a membership." };
  const r = await saveSet(supabase, { sessionId, exerciseId, setNumber, weightKg, reps });
  return { ok: r.ok, pr: r.pr, error: r.error };
}

export async function removeSet(sessionId: string, exerciseId: string, setNumber: number) {
  const { supabase } = await myMember();
  await deleteSet(supabase, sessionId, exerciseId, setNumber);
}

export async function finishWorkout(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await myMember();
  const r = await finishSession(supabase, sessionId, text(formData, "notes") || null);
  if (!r.ok) return { error: r.error };
  redirect(`/portal/progress?tab=workouts&done=${sessionId}`);
}

export async function discardWorkout(sessionId: string) {
  const { supabase } = await myMember();
  await supabase.from("workout_sessions").delete().eq("id", sessionId);
  redirect("/portal/train");
}

// The member pauses or resumes their own membership.
export async function freezeMyMembership(action: "freeze" | "unfreeze"): Promise<ActionState> {
  const { membership } = await requireMember();
  if (!(await hasFeature(membership.gymId, "self_pause"))) return { error: "Ask the front desk to pause your membership." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("freeze_my_membership", { p_gym_id: membership.gymId, p_action: action });
  if (error) return { error: errorMessage(error, "Couldn't update your membership.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: action === "freeze" ? "Membership paused." : "Welcome back. Your membership is active again." };
}
