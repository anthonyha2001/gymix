import Image from "next/image";
import { Play } from "lucide-react";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Card, buttonClass } from "@/components/ui";
import { formatKg, mediaUrl, musclesLabel } from "@/lib/exercises";
import { hoursAgoIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { recordOnMachine } from "@/app/portal/actions";

// How to use a machine, the member's numbers on it, and "Record this".
// Shown on the machine's sticker page and as a dialog in the portal.
export async function MachineDetail({ id, viewer, showName = true }: { id: string; viewer: { id: string }; showName?: boolean }) {
  const supabase = await createClient();
  const { data: machine } = await supabase
    .from("gym_machines")
    .select("id, gym_id, name, description, photo_path, machine_exercises(exercises(id, name, primary_muscles, instructions, image_paths))")
    .eq("id", id)
    .maybeSingle();
  // RLS hides machines from other gyms.
  if (!machine) return null;

  const exercises = machine.machine_exercises.map((me) => me.exercises).filter((e) => e !== null);
  const { data: me } = await supabase
    .from("members")
    .select("id")
    .eq("gym_id", machine.gym_id)
    .eq("user_id", viewer.id)
    .maybeSingle();
  const { data: bests } = me
    ? await supabase
        .from("exercise_bests")
        .select("exercise_id, best_weight_kg, last_logged_at")
        .eq("member_id", me.id)
        .in("exercise_id", exercises.map((e) => e.id))
    : { data: [] };
  const { data: lastSets } = me
    ? await supabase
        .from("set_logs")
        .select("exercise_id, weight_kg, reps, logged_at")
        .eq("member_id", me.id)
        .in("exercise_id", exercises.map((e) => e.id))
        .order("logged_at", { ascending: false })
        .limit(50)
    : { data: [] };
  // A workout already running? Then tapping a machine adds to it.
  const { data: openWorkout } = me
    ? await supabase
        .from("workout_sessions")
        .select("id, day_name")
        .eq("member_id", me.id)
        .is("finished_at", null)
        .gte("started_at", hoursAgoIso(12))
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {machine.photo_path && (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
            <Image src={mediaUrl(machine.photo_path)} alt="" fill unoptimized sizes="80px" className="object-cover" />
          </div>
        )}
        <div>
          {showName && <h1 className="text-2xl font-semibold tracking-tight">{machine.name}</h1>}
          {machine.description && <p className="text-sm text-muted">{machine.description}</p>}
        </div>
      </div>
      {me && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm">
          {openWorkout
            ? `Your workout “${openWorkout.day_name ?? "Workout"}” is running — record an exercise below to add it.`
            : "Record an exercise below to start a workout on this machine."}
        </p>
      )}

      {exercises.map((ex) => {
        const best = bests?.find((b) => b.exercise_id === ex.id);
        const last = lastSets?.find((s) => s.exercise_id === ex.id);
        return (
          <Card key={ex.id} className="overflow-hidden">
            <ExerciseAnimation paths={ex.image_paths} name={ex.name} className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{ex.name}</p>
                  <p className="text-sm text-muted">{musclesLabel(ex.primary_muscles)}</p>
                </div>
                {me && (
                  <form action={recordOnMachine.bind(null, machine.id, ex.id)}>
                    <button className={buttonClass("primary", "h-10")}>
                      <Play className="size-4" /> {openWorkout ? "Add to workout" : "Record this"}
                    </button>
                  </form>
                )}
              </div>
              {me && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-canvas p-3">
                    <p className="text-xs text-muted">Last time</p>
                    <p className="font-semibold">{last ? `${formatKg(last.weight_kg)} × ${last.reps}` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-canvas p-3">
                    <p className="text-xs text-muted">Your best</p>
                    <p className="font-semibold">{best ? formatKg(best.best_weight_kg) : "—"}</p>
                  </div>
                </div>
              )}
              {ex.instructions.length > 0 && (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  {ex.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        );
      })}

    </div>
  );
}
