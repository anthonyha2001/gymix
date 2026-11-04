import type { Metadata } from "next";
import { Confetti } from "@/components/confetti";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Nfc } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireUnfrozenMember } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { WorkoutLogger, type LoggerExercise } from "./workout-logger";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage({ params }: PageProps<"/portal/workout/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Workout params={params} />
    </Suspense>
  );
}

async function Workout({ params }: { params: PageProps<"/portal/workout/[id]">["params"] }) {
  const { id } = await params;
  const { viewer, membership } = await requireUnfrozenMember();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, member_id, program_id, day_id, day_name, started_at, finished_at, members!inner(user_id), programs(name)")
    .eq("id", id)
    .maybeSingle();
  // Only the member's own workouts open here (staff can read them, but not log).
  if (!session || session.members.user_id !== viewer.id) notFound();

  // The workout's exercise list (program day, added by hand, or tapped machines).
  const { data: list } = await supabase
    .from("workout_exercises")
    .select(
      "id, exercise_id, position, added_via, exercise:exercises(id, name, image_paths), target:program_exercises(sets, reps, target_weight_kg, rest_seconds, notes), machine:gym_machines(name)",
    )
    .eq("session_id", id)
    .order("position");
  const exerciseIds = (list ?? []).map((w) => w.exercise_id);

  const [{ data: thisSession }, { data: history }, { data: bests }] = await Promise.all([
    supabase.from("set_logs").select("exercise_id, set_number, weight_kg, reps").eq("session_id", id),
    exerciseIds.length
      ? supabase
          .from("set_logs")
          .select("session_id, exercise_id, set_number, weight_kg, reps, logged_at")
          .eq("member_id", session.member_id)
          .in("exercise_id", exerciseIds)
          .neq("session_id", id)
          .order("logged_at", { ascending: false })
          .limit(300)
      : { data: [] },
    exerciseIds.length
      ? supabase.from("exercise_bests").select("exercise_id, best_weight_kg").eq("member_id", session.member_id).in("exercise_id", exerciseIds)
      : { data: [] },
  ]);

  // Sets from the most recent earlier workout that included each exercise.
  const lastTime = new Map<string, { weight: number; reps: number }[]>();
  for (const exId of exerciseIds) {
    const rows = (history ?? []).filter((h) => h.exercise_id === exId);
    const lastSession = rows[0]?.session_id;
    lastTime.set(
      exId,
      rows
        .filter((r) => r.session_id === lastSession)
        .sort((a, b) => a.set_number - b.set_number)
        .map((r) => ({ weight: Number(r.weight_kg), reps: r.reps })),
    );
  }

  const logged: Record<string, Record<number, { weight: number; reps: number }>> = {};
  for (const s of thisSession ?? []) {
    (logged[s.exercise_id] ??= {})[s.set_number] = { weight: Number(s.weight_kg), reps: s.reps };
  }

  const exercises: LoggerExercise[] = (list ?? []).map((w) => ({
    key: w.id,
    workoutExerciseId: w.id,
    exerciseId: w.exercise_id,
    name: w.exercise?.name ?? w.exercise_id,
    imagePaths: w.exercise?.image_paths ?? [],
    sets: w.target?.sets ?? 3,
    reps: w.target?.reps ?? "10",
    targetWeightKg: w.target?.target_weight_kg === null || w.target?.target_weight_kg === undefined ? null : Number(w.target.target_weight_kg),
    restSeconds: w.target?.rest_seconds ?? 90,
    notes: w.target?.notes ?? null,
    source: w.machine?.name ? `Tapped: ${w.machine.name}` : w.added_via === "manual" ? "Added by you" : null,
    lastTime: lastTime.get(w.exercise_id) ?? [],
    bestKg: bests?.find((b) => b.exercise_id === w.exercise_id)?.best_weight_kg ?? null,
  }));

  return (
    <div className="space-y-4">
      <Link href="/portal/train" className="text-sm text-muted hover:text-ink">
        ← Train
      </Link>
      <div>
        <p className="text-sm text-muted">
          {session.programs?.name ?? "No program"} · started {formatDateTime(session.started_at, membership.timezone)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{session.day_name ?? "Workout"}</h1>
        {session.finished_at && (
          <p className="pr-banner relative mt-2 inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
            <Confetti pieces={16} />
            Finished. Nice work.
          </p>
        )}
      </div>
      {!session.finished_at && (
        <p className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">
          <Nfc className="size-4 shrink-0" /> Add exercises below, or tap your phone on a machine to add it to this workout.
        </p>
      )}
      <WorkoutLogger sessionId={id} exercises={exercises} initialLogged={logged} finished={Boolean(session.finished_at)} />
    </div>
  );
}
