import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ExerciseStats } from "@/components/exercise-how-to";

type Client = Awaited<ReturnType<typeof createClient>>;

// A member's best weight and most recent set for each exercise.
export async function loadExerciseStats(supabase: Client, memberId: string, exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds)];
  if (!ids.length) return {};
  const [{ data: bests }, { data: recent }] = await Promise.all([
    supabase.from("exercise_bests").select("exercise_id, best_weight_kg").eq("member_id", memberId).in("exercise_id", ids),
    supabase
      .from("set_logs")
      .select("exercise_id, weight_kg, reps, logged_at")
      .eq("member_id", memberId)
      .in("exercise_id", ids)
      .order("logged_at", { ascending: false })
      .limit(300),
  ]);
  const stats: Record<string, ExerciseStats> = {};
  for (const id of ids) {
    const last = recent?.find((r) => r.exercise_id === id);
    const best = bests?.find((b) => b.exercise_id === id)?.best_weight_kg;
    stats[id] = {
      bestKg: best !== undefined && best !== null ? Number(best) : null,
      last: last ? { weight: Number(last.weight_kg), reps: last.reps } : null,
    };
  }
  return stats;
}
