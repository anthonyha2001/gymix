"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Repeat, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { ExerciseAnimation } from "@/components/exercise-media";
import { ExercisePicker } from "@/components/exercise-picker";
import { showToast } from "@/components/toaster";
import { Alert, Button, Card, buttonClass, inputClass } from "@/components/ui";
import { musclesLabel } from "@/lib/exercises";
import type { ActionState } from "@/lib/action-result";
import type { ProgramDayView, ProgramExerciseView, ProgramView } from "@/lib/program-shared";
import { addDay, addExercise, deleteDay, moveExercise, removeExercise, saveProgram } from "@/app/program-actions";

// Days → exercises editor. Used by trainers (any program) and members (their own).
// Everything typed (names, sets, reps, weights, notes) is saved with one button;
// adding, removing and reordering happen straight away.
export function ProgramBuilder({ program }: { program: ProgramView }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveProgram(program.id, prev, formData);
    if (result.success) showToast(result.success);
    return result;
  }, {});
  const [, startTransition] = useTransition();

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Card className="space-y-3 p-5">
        <input
          name="name"
          defaultValue={program.name}
          aria-label="Program name"
          maxLength={80}
          required
          className={`${inputClass} h-11 text-lg font-semibold`}
        />
        <textarea
          name="notes"
          defaultValue={program.notes ?? ""}
          maxLength={2000}
          rows={2}
          placeholder="Notes for the whole program, e.g. warm up 10 min on the bike first."
          aria-label="Program notes"
          className={`${inputClass} h-auto py-2`}
        />
      </Card>
      {program.days.map((day) => (
        <DayCard key={day.id} day={day} />
      ))}
      <button type="button" onClick={() => startTransition(() => addDay(program.id))} className={buttonClass("secondary", "w-full border-dashed")}>
        <Plus className="size-4" /> Add a training day
      </button>

      {/* One save for the whole program, always in reach. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save program"}
        </Button>
      </div>
    </form>
  );
}

function DayCard({ day }: { day: ProgramDayView }) {
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          name={`day.${day.id}.name`}
          defaultValue={day.name}
          aria-label="Day name"
          maxLength={60}
          required
          className={`${inputClass} h-9 min-w-48 flex-1 font-semibold`}
        />
        <button
          type="button"
          aria-label={`Delete ${day.name}`}
          onClick={async () => {
            if (await confirm(`Delete “${day.name}” and all its exercises?`, { danger: true, confirmLabel: "Delete day" })) {
              startTransition(() => deleteDay(day.id));
            }
          }}
          className={buttonClass("ghost", "h-9 px-2 text-muted hover:text-danger")}
        >
          <Trash2 className="size-4" />
        </button>
        {confirmDialog}
      </div>

      {day.exercises.length === 0 && !adding && <p className="px-4 py-4 text-sm text-muted">No exercises yet.</p>}
      <ul className="divide-y divide-line">
        {day.exercises.map((pe, i) => (
          <ExerciseRow key={pe.id} pe={pe} first={i === 0} last={i === day.exercises.length - 1} />
        ))}
      </ul>

      <div className="border-t border-line p-4">
        {adding ? (
          <div className="space-y-3">
            <ExercisePicker
              source="gym"
              selectedIds={day.exercises.map((e) => e.exercise.id)}
              onPick={(ex) => startTransition(() => addExercise(day.id, ex.id))}
            />
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Done adding
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add exercise
          </Button>
        )}
      </div>
    </Card>
  );
}

function ExerciseRow({ pe, first, last }: { pe: ProgramExerciseView; first: boolean; last: boolean }) {
  const [, startTransition] = useTransition();
  const small = `${inputClass} h-9 px-2`;
  const f = (k: string) => `ex.${pe.id}.${k}`;

  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <ExerciseAnimation paths={pe.exercise.imagePaths} name={pe.exercise.name} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{pe.exercise.name}</p>
          <p className="text-xs text-muted">{musclesLabel(pe.exercise.primaryMuscles)}</p>
          {pe.swappedFromName && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              <Repeat className="size-3" /> Member swapped from {pe.swappedFromName}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" disabled={first} aria-label="Move up" onClick={() => startTransition(() => moveExercise(pe.id, "up"))} className={buttonClass("ghost", "h-8 px-2")}>
            <ArrowUp className="size-4" />
          </button>
          <button type="button" disabled={last} aria-label="Move down" onClick={() => startTransition(() => moveExercise(pe.id, "down"))} className={buttonClass("ghost", "h-8 px-2")}>
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${pe.exercise.name}`}
            onClick={() => startTransition(() => removeExercise(pe.id))}
            className={buttonClass("ghost", "h-8 px-2 text-muted hover:text-danger")}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[70px_90px_100px_100px_1fr]">
        <label className="text-xs text-muted">
          Sets
          <input name={f("sets")} type="number" min={1} max={20} defaultValue={pe.sets} className={small} />
        </label>
        <label className="text-xs text-muted">
          Reps
          <input name={f("reps")} defaultValue={pe.reps} maxLength={20} placeholder="8-12" className={small} />
        </label>
        <label className="text-xs text-muted">
          Weight (kg)
          <input name={f("target_weight_kg")} inputMode="decimal" defaultValue={pe.targetWeightKg ?? ""} placeholder="—" className={small} />
        </label>
        <label className="text-xs text-muted">
          Rest (sec)
          <input name={f("rest_seconds")} type="number" min={0} max={900} step={15} defaultValue={pe.restSeconds} className={small} />
        </label>
        <label className="col-span-2 text-xs text-muted sm:col-span-1">
          Notes
          <input name={f("notes")} defaultValue={pe.notes ?? ""} maxLength={300} placeholder="e.g. slow on the way down" className={small} />
        </label>
      </div>
    </li>
  );
}
