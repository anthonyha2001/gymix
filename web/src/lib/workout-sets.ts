import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { errorMessage } from "@/lib/action-result";

// Saving workout sets, shared by the workout screen (server actions) and the
// offline sync (/api/sync replays what was logged without a connection).
// Row-level security decides whose sessions these are; nothing here trusts
// the caller beyond that.

type Db = SupabaseClient<Database>;
export type SetInput = { sessionId: string; exerciseId: string; setNumber: number; weightKg: number; reps: number };
// permanent: retrying won't help (bad data, session gone), so the offline
// queue drops it instead of trying forever.
export type SetOutcome = { ok: boolean; pr: boolean; error?: string; permanent?: boolean };

async function sessionOf(supabase: Db, sessionId: string) {
  const { data } = await supabase.from("workout_sessions").select("id, member_id, gym_id, finished_at").eq("id", sessionId).maybeSingle();
  return data;
}

export function validSet(s: SetInput): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(s.sessionId)) return "Unknown workout.";
  if (typeof s.exerciseId !== "string" || !s.exerciseId || s.exerciseId.length > 200) return "Unknown exercise.";
  if (!Number.isInteger(s.setNumber) || s.setNumber < 1 || s.setNumber > 50) return "Check the set number.";
  if (!Number.isFinite(s.weightKg) || s.weightKg < 0 || s.weightKg > 1000) return "Check the weight.";
  if (!Number.isInteger(s.reps) || s.reps < 0 || s.reps > 500) return "Check the reps.";
  return null;
}

export async function saveSet(supabase: Db, s: SetInput): Promise<SetOutcome> {
  const invalid = validSet(s);
  if (invalid) return { ok: false, pr: false, error: invalid, permanent: true };
  const session = await sessionOf(supabase, s.sessionId);
  if (!session) return { ok: false, pr: false, error: "This workout no longer exists.", permanent: true };

  // Best weight before this workout, to spot a new personal record.
  const { data: prev } = await supabase
    .from("set_logs")
    .select("weight_kg")
    .eq("member_id", session.member_id)
    .eq("exercise_id", s.exerciseId)
    .neq("session_id", s.sessionId)
    .gt("reps", 0)
    .order("weight_kg", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Update the set if it's already logged, else insert it. (Not an upsert: that
  // would also rewrite the key columns, which members may not update.)
  const { data: updated, error: updateError } = await supabase
    .from("set_logs")
    .update({ weight_kg: s.weightKg, reps: s.reps })
    .eq("session_id", s.sessionId)
    .eq("exercise_id", s.exerciseId)
    .eq("set_number", s.setNumber)
    .select("id");
  const { error } =
    updateError || updated?.length
      ? { error: updateError }
      : await supabase.from("set_logs").insert({
          session_id: s.sessionId,
          member_id: session.member_id,
          exercise_id: s.exerciseId,
          set_number: s.setNumber,
          weight_kg: s.weightKg,
          reps: s.reps,
        });
  if (error) {
    // Constraint and permission errors won't fix themselves.
    const permanent = ["23503", "23514", "42501", "22P02"].includes(error.code ?? "");
    return { ok: false, pr: false, error: errorMessage(error, "Couldn't save the set."), permanent };
  }
  const pr = prev !== null && s.reps > 0 && s.weightKg > Number(prev.weight_kg);
  if (pr) {
    const { data: ex } = await supabase.from("exercises").select("name").eq("id", s.exerciseId).maybeSingle();
    await supabase.rpc("note_personal_record", { p_gym_id: session.gym_id, p_exercise: ex?.name ?? "Exercise", p_weight: s.weightKg });
  }
  return { ok: true, pr };
}

export async function deleteSet(supabase: Db, sessionId: string, exerciseId: string, setNumber: number) {
  const { error } = await supabase.from("set_logs").delete().eq("session_id", sessionId).eq("exercise_id", exerciseId).eq("set_number", setNumber);
  return { ok: !error, error: error ? errorMessage(error, "Couldn't remove the set.") : undefined };
}

// Finishing: `finishedAt` is when the member pressed Finish (offline it may be
// earlier than now). Notes only overwrite when given.
export async function finishSession(supabase: Db, sessionId: string, notes: string | null, finishedAt?: string) {
  const at = finishedAt && !Number.isNaN(Date.parse(finishedAt)) && Date.parse(finishedAt) <= Date.now() + 60_000 ? finishedAt : new Date().toISOString();
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ finished_at: at, ...(notes ? { notes: notes.slice(0, 1000) } : {}) })
    .eq("id", sessionId)
    .select("id");
  if (error) return { ok: false, error: errorMessage(error, "Couldn't finish the workout."), permanent: false };
  if (!data?.length) return { ok: false, error: "This workout no longer exists.", permanent: true };
  return { ok: true };
}
