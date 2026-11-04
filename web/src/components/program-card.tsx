import Link from "next/link";
import { Info, Play, Repeat } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ExerciseAnimation } from "@/components/exercise-media";
import { ExerciseHowTo, type ExerciseStats } from "@/components/exercise-how-to";
import { Badge, Card, buttonClass } from "@/components/ui";
import { formatRest } from "@/lib/exercises";
import { setsLabel, type ProgramExerciseView, type ProgramView } from "@/lib/program-shared";
import { startWorkout } from "@/app/portal/actions";
import { SwapButton } from "@/app/portal/programs/forms";

// A member's program, day by day. Tap an exercise for the full how-to.
// readOnly = staff's "View as member" preview (no swapping or starting workouts).
export function ProgramCard({
  program,
  stats = {},
  readOnly = false,
}: {
  program: ProgramView;
  stats?: Record<string, ExerciseStats>;
  readOnly?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-ink p-5 text-white">
        <div>
          <p className="text-sm text-white/70">{program.kind === "trainer" ? "From your trainer" : "Your own program"}</p>
          <h2 className="text-xl font-semibold">{program.name}</h2>
          {program.notes && <p className="mt-1 text-sm text-white/80">{program.notes}</p>}
        </div>
        {program.kind === "self" && !readOnly && (
          <Link href={`/portal/programs?edit=${program.id}`} className={buttonClass("secondary", "h-9")}>
            Edit
          </Link>
        )}
      </div>

      {program.days.length === 0 && <p className="p-5 text-sm text-muted">No training days yet.</p>}
      <div className="divide-y divide-line">
        {program.days.map((day) => (
          <details key={day.id} className="group" open={program.days.length === 1}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span>
                <span className="font-semibold">{day.name}</span>
                <span className="block text-xs text-muted">{day.exercises.length} exercises</span>
              </span>
              <span className="text-sm text-muted group-open:hidden">Show</span>
              <span className="hidden text-sm text-muted group-open:inline">Hide</span>
            </summary>
            <ul className="space-y-3 px-5 pb-4">
              {day.exercises.map((pe) => (
                <ExerciseItem key={pe.id} pe={pe} stats={stats[pe.exercise.id]} readOnly={readOnly} />
              ))}
            </ul>
            {day.exercises.length > 0 && !readOnly && (
              <form action={startWorkout.bind(null, program.id, day.id, day.name)} className="px-5 pb-5">
                <button className={buttonClass("primary", "h-11 w-full")}>
                  <Play className="size-4" /> Start {day.name}
                </button>
              </form>
            )}
          </details>
        ))}
      </div>
      {program.kind === "trainer" && program.days.some((d) => d.exercises.some((e) => e.swappedFromName)) && (
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          <Badge tone="amber">Note</Badge> The trainer can see swapped exercises.
        </p>
      )}
    </Card>
  );
}

// One exercise in a program: tap for the full how-to; members can swap it.
export function ExerciseItem({
  pe,
  stats,
  readOnly = false,
}: {
  pe: ProgramExerciseView;
  stats?: ExerciseStats;
  readOnly?: boolean;
}) {
  return (
    <li className="rounded-lg border border-line p-3">
      <Dialog
        unstyledTrigger
        triggerClassName="flex w-full gap-3 text-left"
        title={pe.exercise.name}
        size="lg"
        label={
          <>
            <ExerciseAnimation paths={pe.exercise.imagePaths} name={pe.exercise.name} className="size-24" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{pe.exercise.name}</span>
              <span className="block text-sm">{setsLabel(pe)}</span>
              <span className="block text-xs text-muted">Rest {formatRest(pe.restSeconds)}</span>
              {pe.notes && <span className="mt-1 block text-xs">Note: {pe.notes}</span>}
              {pe.swappedFromName && (
                <span className="mt-1 flex items-center gap-1 text-xs text-amber-800">
                  <Repeat className="size-3" /> Swapped for {pe.swappedFromName}
                </span>
              )}
              <span className="mt-1 flex items-center gap-1 text-xs font-medium text-ink/70">
                <Info className="size-3" /> Tap for how to do it
              </span>
            </span>
          </>
        }
      >
        <ExerciseHowTo
          name={pe.exercise.name}
          imagePaths={pe.exercise.imagePaths}
          primaryMuscles={pe.exercise.primaryMuscles}
          instructions={pe.exercise.instructions}
          stats={stats ?? { bestKg: null, last: null }}
        />
      </Dialog>
      {!readOnly && (
        <div className="mt-2 flex justify-end">
          <SwapButton programExerciseId={pe.id} exerciseId={pe.exercise.id} exerciseName={pe.exercise.name} />
        </div>
      )}
    </li>
  );
}
