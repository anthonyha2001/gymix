import Link from "next/link";
import { Play } from "lucide-react";
import { RouteModal } from "@/components/route-modal";
import { buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// One workout's sets, grouped by exercise. Unfinished ones can be continued.
export async function WorkoutModal({ sessionId, memberId, timeZone }: { sessionId: string; memberId: string; timeZone: string }) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, member_id, day_name, started_at, finished_at, set_logs(exercise_id, set_number, weight_kg, reps, exercises(name))")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.member_id !== memberId) return null;

  const byExercise = new Map<string, { name: string; sets: { n: number; kg: number; reps: number }[] }>();
  for (const l of session.set_logs) {
    const entry = byExercise.get(l.exercise_id) ?? { name: l.exercises?.name ?? l.exercise_id, sets: [] };
    entry.sets.push({ n: l.set_number, kg: Number(l.weight_kg), reps: l.reps });
    byExercise.set(l.exercise_id, entry);
  }

  return (
    <RouteModal param="workout" title={session.day_name ?? "Workout"} description={formatDateTime(session.started_at, timeZone)}>
      <div className="space-y-4">
        {!session.finished_at && (
          <Link href={`/portal/workout/${session.id}`} className={buttonClass("primary", "h-11 w-full")}>
            <Play className="size-4" /> Continue this workout
          </Link>
        )}
        {byExercise.size === 0 ? (
          <p className="text-sm text-muted">No sets logged.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {[...byExercise.values()].map((e) => (
              <li key={e.name} className="px-4 py-3 text-sm">
                <p className="font-medium">{e.name}</p>
                <p className="text-muted tabular-nums">
                  {e.sets
                    .sort((a, b) => a.n - b.n)
                    .map((s) => (s.kg > 0 ? `${s.kg}×${s.reps}` : `${s.reps} reps`))
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RouteModal>
  );
}
