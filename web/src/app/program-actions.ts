"use server";

// Program editing shared by the coach builder and the member's own-program
// builder. Permission is enforced by the database (can_edit_program), so these
// only check the user is signed in.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

// Saves the whole program in one go: name, notes, day names and every
// exercise's targets (fields named day.<id>.name and ex.<id>.<field>).
export async function saveProgram(programId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const name = text(formData, "name");
  if (!name) return { error: "Give the program a name." };
  const keys = [...formData.keys()];
  const idsFor = (prefix: string) => [...new Set(keys.filter((k) => k.startsWith(prefix)).map((k) => k.split(".")[1]))];

  const days = [];
  for (const id of idsFor("day.")) {
    const dayName = text(formData, `day.${id}.name`);
    if (!dayName) return { error: "Name every day, e.g. “Push” or “Legs”." };
    days.push({ id, name: dayName });
  }

  const exercises = [];
  for (const id of idsFor("ex.")) {
    const sets = Number(text(formData, `ex.${id}.sets`));
    const reps = text(formData, `ex.${id}.reps`);
    const weightRaw = text(formData, `ex.${id}.target_weight_kg`).replace(",", ".");
    const weight = weightRaw ? Number(weightRaw) : null;
    const rest = Number(text(formData, `ex.${id}.rest_seconds`) || "90");
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) return { error: "Sets: 1 to 20." };
    if (!reps || reps.length > 20) return { error: "Reps: e.g. 10 or 8-12." };
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) return { error: "Enter a valid weight." };
    if (!Number.isInteger(rest) || rest < 0 || rest > 900) return { error: "Rest: 0 to 900 seconds." };
    exercises.push({ id, sets, reps, target_weight_kg: weight, rest_seconds: rest, notes: text(formData, `ex.${id}.notes`) || null });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("programs").update({ name, notes: text(formData, "notes") || null }).eq("id", programId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  const results = await Promise.all([
    ...days.map(({ id, ...d }) => supabase.from("program_days").update(d).eq("id", id).eq("program_id", programId)),
    ...exercises.map(({ id, ...e }) => supabase.from("program_exercises").update(e).eq("id", id)),
  ]);
  const failed = results.find((r) => r.error)?.error;
  if (failed) return { error: errorMessage(failed, "Couldn't save everything.") };
  refresh();
  return { success: "Program saved." };
}

export async function deleteProgram(programId: string, redirectTo: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from("programs").delete().eq("id", programId);
  redirect(redirectTo);
}

export async function addDay(programId: string) {
  await requireViewer();
  const supabase = await createClient();
  const { count } = await supabase.from("program_days").select("id", { count: "exact", head: true }).eq("program_id", programId);
  const n = (count ?? 0) + 1;
  await supabase.from("program_days").insert({ program_id: programId, position: n, name: `Day ${n}` });
  refresh();
}

export async function deleteDay(dayId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from("program_days").delete().eq("id", dayId);
  refresh();
}

export async function addExercise(dayId: string, exerciseId: string) {
  await requireViewer();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("program_exercises")
    .select("position")
    .eq("day_id", dayId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("program_exercises").insert({ day_id: dayId, exercise_id: exerciseId, position: (last?.position ?? 0) + 1 });
  refresh();
}

export async function moveExercise(peId: string, direction: "up" | "down") {
  await requireViewer();
  const supabase = await createClient();
  const { data: pe } = await supabase.from("program_exercises").select("id, day_id, position").eq("id", peId).single();
  if (!pe) return;
  const { data: siblings } = await supabase
    .from("program_exercises")
    .select("id, position")
    .eq("day_id", pe.day_id)
    .order("position")
    .order("id");
  if (!siblings) return;
  const i = siblings.findIndex((s) => s.id === peId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  // Rewrite positions 1..n so ties from older data can't stick.
  await Promise.all(siblings.map((s, idx) => supabase.from("program_exercises").update({ position: idx + 1 }).eq("id", s.id)));
  refresh();
}

export async function removeExercise(peId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from("program_exercises").delete().eq("id", peId);
  refresh();
}

export async function swapExercise(peId: string, exerciseId: string): Promise<ActionState> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("swap_program_exercise", { p_program_exercise_id: peId, p_exercise_id: exerciseId });
  if (error) return { error: errorMessage(error, "Couldn't swap the exercise.") };
  refresh();
  return { success: "Swapped." };
}

// Delete from a list (no redirect).
export async function removeProgram(programId: string): Promise<ActionState> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) return { error: errorMessage(error, "Couldn't delete the program.") };
  refresh();
  return { success: "Program deleted." };
}

// Retire an active program without deleting it (its logged workouts stay).
export async function setProgramActive(programId: string, isActive: boolean): Promise<ActionState> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("programs").update({ is_active: isActive }).eq("id", programId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: isActive ? "Program reactivated." : "Program retired." };
}
