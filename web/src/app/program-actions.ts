"use server";

// Program editing shared by the coach builder and the member's own-program
// builder. Permission is enforced by the database (can_edit_program), so these
// only check the user is signed in.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { errorMessage, type ActionState } from "@/lib/action-result";

export type ProgramDraft = {
  name: string;
  notes: string;
  days: {
    id: string | null;
    name: string;
    exercises: {
      id: string | null;
      exerciseId: string;
      sets: number;
      reps: string;
      weight: string;
      rest: number;
      notes: string;
    }[];
  }[];
};

// Saves the whole program in one go (the builder edits everything in the
// browser first). Existing days and exercises keep their ids.
export async function saveProgramDraft(programId: string, draft: ProgramDraft): Promise<ActionState> {
  await requireViewer();
  const name = draft.name.trim();
  if (!name) return { error: "Give the program a name." };
  if (name.length > 80) return { error: "Keep the program name under 80 characters." };
  if (draft.notes.length > 2000) return { error: "Keep the notes under 2000 characters." };

  const days = [];
  for (const [i, day] of draft.days.entries()) {
    const dayName = day.name.trim();
    if (!dayName) return { error: `Name day ${i + 1}, e.g. “Push” or “Legs”.` };
    if (dayName.length > 60) return { error: "Keep day names under 60 characters." };
    const exercises = [];
    for (const ex of day.exercises) {
      const reps = ex.reps.trim();
      const weightRaw = ex.weight.trim().replace(",", ".");
      const weight = weightRaw ? Number(weightRaw) : null;
      if (!Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 20) return { error: `${dayName}: sets must be 1 to 20.` };
      if (!reps || reps.length > 20) return { error: `${dayName}: enter reps, e.g. 10 or 8-12.` };
      if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) return { error: `${dayName}: enter a valid weight.` };
      if (!Number.isInteger(ex.rest) || ex.rest < 0 || ex.rest > 900) return { error: `${dayName}: rest must be 0 to 900 seconds.` };
      if (ex.notes.length > 300) return { error: `${dayName}: keep notes under 300 characters.` };
      exercises.push({
        id: ex.id,
        exercise_id: ex.exerciseId,
        sets: ex.sets,
        reps,
        target_weight_kg: weight === null ? "" : String(weight),
        rest_seconds: ex.rest,
        notes: ex.notes.trim(),
      });
    }
    days.push({ id: day.id, name: dayName, exercises });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_program", {
    p_program_id: programId,
    p_program: { name, notes: draft.notes.trim(), days },
  });
  if (error) return { error: errorMessage(error, "Couldn't save the program.") };
  refresh();
  return { success: "Program saved." };
}

export async function deleteProgram(programId: string, redirectTo: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from("programs").delete().eq("id", programId);
  redirect(redirectTo);
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
