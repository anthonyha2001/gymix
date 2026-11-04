"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Plus, Timer, Trophy, X } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ExercisePicker } from "@/components/exercise-picker";
import { showToast } from "@/components/toaster";
import { useConfirm } from "@/components/confirm";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Alert, Button, Card, buttonClass, inputClass } from "@/components/ui";
import { formatKg } from "@/lib/exercises";
import { setsLabel } from "@/lib/program-shared";
import { addWorkoutExercise, discardWorkout, finishWorkout, logSet, removeSet, removeWorkoutExercise } from "../../actions";

export type LoggerExercise = {
  key: string;
  workoutExerciseId: string | null;
  exerciseId: string;
  // Where it came from, e.g. "Tapped: Leg press" (null for program exercises).
  source: string | null;
  name: string;
  imagePaths: string[];
  sets: number;
  reps: string;
  targetWeightKg: number | null;
  restSeconds: number;
  notes: string | null;
  lastTime: { weight: number; reps: number }[];
  bestKg: number | null;
};

type Logged = Record<string, Record<number, { weight: number; reps: number }>>;

export function WorkoutLogger({
  sessionId,
  exercises,
  initialLogged,
  finished,
}: {
  sessionId: string;
  exercises: LoggerExercise[];
  initialLogged: Logged;
  finished: boolean;
}) {
  const [logged, setLogged] = useState<Logged>(initialLogged);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  const [finishState, finish, finishing] = useActionState(finishWorkout.bind(null, sessionId), {});
  const [confirmDialog, confirm] = useConfirm();

  const totalSets = Object.values(logged).reduce((n, sets) => n + Object.keys(sets).length, 0);

  return (
    <div className="space-y-4 pb-24">
      {pr && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-brand p-4 font-semibold">
          <Trophy className="size-6" /> New personal record: {pr}!
        </div>
      )}

      {exercises.length === 0 && (
        <Card className="p-6 text-center">
          <p className="font-medium">No exercises yet</p>
          <p className="mt-1 text-sm text-muted">Add one below, or tap your phone on the machine you&apos;re about to use.</p>
        </Card>
      )}

      {exercises.map((ex) => (
        <ExerciseBlock
          key={ex.key}
          sessionId={sessionId}
          exercise={ex}
          logged={logged[ex.exerciseId] ?? {}}
          disabled={finished}
          onLogged={(setNumber, value, isPr) => {
            setLogged((cur) => ({ ...cur, [ex.exerciseId]: { ...cur[ex.exerciseId], [setNumber]: value } }));
            if (ex.restSeconds > 0) setRestEndsAt(Date.now() + ex.restSeconds * 1000);
            if (isPr) {
              setPr(`${ex.name} ${formatKg(value.weight)}`);
              navigator.vibrate?.([60, 40, 60]);
            }
          }}
          onRemoved={(setNumber) =>
            setLogged((cur) => {
              const sets = { ...cur[ex.exerciseId] };
              delete sets[setNumber];
              return { ...cur, [ex.exerciseId]: sets };
            })
          }
        />
      ))}

      {!finished && (
        <AddExercise sessionId={sessionId} existing={exercises.map((e) => e.exerciseId)} />
      )}

      {!finished && (
        <Card className="space-y-3 p-5">
          <form action={finish} className="space-y-3">
            {finishState.error && <Alert tone="error">{finishState.error}</Alert>}
            <textarea
              name="notes"
              rows={2}
              maxLength={1000}
              placeholder="How did it feel? (optional)"
              aria-label="Workout notes"
              className={`${inputClass} h-auto py-2`}
            />
            <Button type="submit" disabled={finishing || totalSets === 0} className="h-12 w-full text-base">
              {finishing ? "Saving…" : `Finish workout (${totalSets} ${totalSets === 1 ? "set" : "sets"})`}
            </Button>
          </form>
          <button
            type="button"
            onClick={async () => {
              if (await confirm("Discard this workout and all the sets you logged?", { danger: true, confirmLabel: "Discard workout" })) {
                await discardWorkout(sessionId);
              }
            }}
            className={buttonClass("ghost", "w-full text-muted")}
          >
            Discard workout
          </button>
          {confirmDialog}
        </Card>
      )}

      {restEndsAt && <RestTimer endsAt={restEndsAt} onDone={() => setRestEndsAt(null)} />}
    </div>
  );
}

function ExerciseBlock({
  sessionId,
  exercise,
  logged,
  disabled,
  onLogged,
  onRemoved,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  logged: Record<number, { weight: number; reps: number }>;
  disabled: boolean;
  onLogged: (setNumber: number, value: { weight: number; reps: number }, pr: boolean) => void;
  onRemoved: (setNumber: number) => void;
}) {
  const loggedNumbers = Object.keys(logged).map(Number);
  const [rows, setRows] = useState(Math.max(exercise.sets, ...loggedNumbers, 0));
  const doneCount = loggedNumbers.length;

  return (
    <Card>
      <div className="flex gap-3 p-4">
        <ExerciseAnimation paths={exercise.imagePaths} name={exercise.name} className="size-20" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{exercise.name}</p>
          {exercise.source && <p className="text-xs font-medium text-ink/60">{exercise.source}</p>}
          <p className="text-sm">Target: {setsLabel(exercise)}</p>
          <p className="text-xs text-muted">
            {exercise.lastTime.length
              ? `Last time: ${exercise.lastTime.map((s) => `${s.weight}×${s.reps}`).join(" · ")}`
              : "First time — find a weight you can do with good form."}
          </p>
          {exercise.bestKg !== null && exercise.bestKg > 0 && <p className="text-xs text-muted">Your best: {formatKg(exercise.bestKg)}</p>}
          {exercise.notes && <p className="mt-1 text-xs">Note: {exercise.notes}</p>}
        </div>
        <div className="flex h-fit items-center gap-1">
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs tabular-nums text-muted">
            {doneCount}/{rows}
          </span>
          {!disabled && exercise.workoutExerciseId && doneCount === 0 && (
            <button
              type="button"
              aria-label={`Remove ${exercise.name}`}
              onClick={async () => {
                const r = await removeWorkoutExercise(exercise.workoutExerciseId!, sessionId, exercise.exerciseId);
                if (r.error) showToast(r.error, "error");
              }}
              className="grid size-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-danger"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-2 px-4 pt-2 text-xs text-muted">
          <span>Set</span>
          <span>kg</span>
          <span>Reps</span>
          <span />
        </div>
        {Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
          <SetRow
            key={n}
            sessionId={sessionId}
            exercise={exercise}
            setNumber={n}
            logged={logged[n]}
            disabled={disabled}
            onLogged={onLogged}
            onRemoved={onRemoved}
          />
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => setRows(rows + 1)}
            className="flex w-full items-center justify-center gap-1 py-2.5 text-sm text-muted hover:text-ink"
          >
            <Plus className="size-4" /> Add set
          </button>
        )}
      </div>
    </Card>
  );
}

function SetRow({
  sessionId,
  exercise,
  setNumber,
  logged,
  disabled,
  onLogged,
  onRemoved,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  setNumber: number;
  logged?: { weight: number; reps: number };
  disabled: boolean;
  onLogged: (setNumber: number, value: { weight: number; reps: number }, pr: boolean) => void;
  onRemoved: (setNumber: number) => void;
}) {
  // Pre-fill: what was logged, else last time's same set, else the target.
  const last = exercise.lastTime[setNumber - 1] ?? exercise.lastTime.at(-1);
  const [weight, setWeight] = useState(String(logged?.weight ?? last?.weight ?? exercise.targetWeightKg ?? ""));
  const [reps, setReps] = useState(String(logged?.reps ?? last?.reps ?? (parseInt(exercise.reps, 10) || "")));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = Boolean(logged);

  function toggle() {
    setError(null);
    startTransition(async () => {
      if (done) {
        await removeSet(sessionId, exercise.exerciseId, setNumber);
        onRemoved(setNumber);
        return;
      }
      const w = Number(weight.replace(",", ".") || "0");
      const r = Number(reps);
      const res = await logSet(sessionId, exercise.exerciseId, setNumber, w, r);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else onLogged(setNumber, { weight: w, reps: r }, res.pr);
    });
  }

  const cell = `${inputClass} h-10 text-center tabular-nums ${done ? "bg-success-soft border-success/30" : ""}`;
  return (
    <div className="px-4 py-1.5">
      <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-2">
        <span className="text-sm font-medium text-muted">{setNumber}</span>
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          disabled={done || disabled}
          aria-label={`Set ${setNumber} weight in kg`}
          className={cell}
        />
        <input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          disabled={done || disabled}
          aria-label={`Set ${setNumber} reps`}
          className={cell}
        />
        <button
          type="button"
          onClick={toggle}
          disabled={pending || disabled}
          aria-label={done ? `Undo set ${setNumber}` : `Log set ${setNumber}`}
          aria-pressed={done}
          className={`grid h-10 place-items-center rounded-lg ${done ? "bg-success text-white" : "bg-canvas text-muted hover:bg-line"}`}
        >
          <Check className="size-5" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function RestTimer({ endsAt, onDone }: { endsAt: number; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div className="fixed inset-x-0 bottom-(--bottom-bar) z-40 border-t border-line bg-ink text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2">
          <Timer className="size-5 text-brand" />
          {left > 0 ? (
            <>
              Rest <span className="text-xl font-bold tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
            </>
          ) : (
            <span className="font-semibold text-brand">Next set — go!</span>
          )}
        </span>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10">
          {left > 0 ? "Skip" : "Close"}
        </button>
      </div>
    </div>
  );
}

function AddExercise({ sessionId, existing }: { sessionId: string; existing: string[] }) {
  const [, startTransition] = useTransition();
  return (
    <Dialog
      label="Add exercise"
      icon={<Plus className="size-4" />}
      title="Add an exercise"
      description="Everything your gym's equipment allows. Tap to add it to this workout."
      variant="secondary"
      size="xl"
      triggerClassName="h-11 w-full"
    >
      <ExercisePicker
        source="gym"
        selectedIds={existing}
        onPick={(ex) => {
          if (existing.includes(ex.id)) return;
          startTransition(async () => {
            const r = await addWorkoutExercise(sessionId, ex.id);
            showToast(r.error ?? `${ex.name} added`, r.error ? "error" : "success");
          });
        }}
      />
    </Dialog>
  );
}
