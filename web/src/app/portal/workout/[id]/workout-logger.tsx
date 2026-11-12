"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, CloudUpload, Plus, Timer, Trophy, X } from "lucide-react";
import { Confetti } from "@/components/confetti";
import { Dialog } from "@/components/dialog";
import { ExercisePicker } from "@/components/exercise-picker";
import { showToast } from "@/components/toaster";
import { useConfirm } from "@/components/confirm";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Alert, Button, Card, buttonClass, inputClass } from "@/components/ui";
import { formatKg } from "@/lib/exercises";
import { setsLabel } from "@/lib/program-shared";
import { addWorkoutExercise, discardWorkout, finishWorkout, logSet, removeSet, removeWorkoutExercise } from "../../actions";
import { isOfflineError, OUTBOX_EVENT, pendingFor, queue } from "@/lib/outbox";
import type { ActionState } from "@/lib/action-result";

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
  finished: finishedOnServer,
}: {
  sessionId: string;
  exercises: LoggerExercise[];
  initialLogged: Logged;
  finished: boolean;
}) {
  const [logged, setLogged] = useState<Logged>(initialLogged);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  // Sets saved on the phone, waiting for a connection ("exerciseId:set").
  const [waiting, setWaiting] = useState<Set<string>>(new Set());
  const [finishedOffline, setFinishedOffline] = useState(false);

  // What's waiting in the offline outbox for this workout: shown as logged
  // (with a cloud mark) even when this page came from the phone's copy.
  useEffect(() => {
    let alive = true;
    let first = true;
    const load = async () => {
      const ops = await pendingFor(sessionId);
      if (!alive) return;
      setWaiting(new Set(ops.flatMap((op) => (op.kind === "set" ? [`${op.exerciseId}:${op.setNumber}`] : []))));
      if (ops.some((op) => op.kind === "finish")) setFinishedOffline(true);
      if (first) {
        first = false;
        setLogged((cur) => {
          const next: Logged = { ...cur };
          for (const op of ops) {
            if (op.kind === "set") next[op.exerciseId] = { ...next[op.exerciseId], [op.setNumber]: { weight: op.weightKg, reps: op.reps } };
            if (op.kind === "remove_set" && next[op.exerciseId]) {
              const sets = { ...next[op.exerciseId] };
              delete sets[op.setNumber];
              next[op.exerciseId] = sets;
            }
          }
          return next;
        });
      }
    };
    load();
    window.addEventListener(OUTBOX_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(OUTBOX_EVENT, load);
    };
  }, [sessionId]);

  // Finish: online as before; offline it's saved on the phone and finishes
  // the workout as soon as the connection is back.
  const [finishState, finish, finishing] = useActionState(async (prev: ActionState, formData: FormData): Promise<ActionState> => {
    const saveOffline = async () => {
      const notes = String(formData.get("notes") ?? "").trim();
      await queue({ kind: "finish", sessionId, notes: notes || null, finishedAt: new Date().toISOString() });
      setFinishedOffline(true);
      setRestEndsAt(null);
      return { success: "Workout saved on your phone. It's sent as soon as you're back online." };
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return saveOffline();
    try {
      return await finishWorkout(sessionId, prev, formData);
    } catch (e) {
      if (isOfflineError(e)) return saveOffline();
      throw e;
    }
  }, {});
  const finished = finishedOnServer || finishedOffline;
  const [confirmDialog, confirm] = useConfirm();

  const totalSets = Object.values(logged).reduce((n, sets) => n + Object.keys(sets).length, 0);

  return (
    <div className="space-y-4 pb-24">
      {pr && (
        <div key={pr} role="status" className="pr-banner relative flex items-center gap-3 rounded-xl bg-brand p-4 font-semibold">
          <Confetti />
          <Trophy className="wiggle size-6" /> New personal record: {pr}!
        </div>
      )}

      {finishedOffline && (
        <div role="status" className="page-enter flex items-center gap-3 rounded-xl bg-ink p-4 text-white">
          <CloudUpload className="size-6 shrink-0 text-brand" />
          <span className="text-sm">
            <b className="block">Workout finished on your phone</b>
            It&apos;s sent to the gym as soon as you&apos;re back online.
          </span>
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
          waiting={waiting}
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
          <form id="finish-workout" action={finish} className="space-y-3">
            {finishState.error && <Alert tone="error">{finishState.error}</Alert>}
            <textarea
              name="notes"
              rows={2}
              maxLength={1000}
              placeholder="How did it feel? (optional)"
              aria-label="Workout notes"
              className={`${inputClass} h-auto py-2`}
            />
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

      {/* Always on screen: the rest timer while it runs, and Finish. */}
      {!finished && (
        <>
          <div aria-hidden className={restEndsAt ? "h-32" : "h-20"} />
          <div className="fixed inset-x-0 bottom-(--bottom-bar) z-40 border-t border-line bg-surface/95 backdrop-blur">
            {restEndsAt && <RestTimer endsAt={restEndsAt} onDone={() => setRestEndsAt(null)} />}
            <div className="mx-auto max-w-3xl px-4 py-3">
              <Button type="submit" form="finish-workout" disabled={finishing || totalSets === 0} className="h-12 w-full text-base">
                {finishing ? "Saving…" : `Finish workout (${totalSets} ${totalSets === 1 ? "set" : "sets"})`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ExerciseBlock({
  sessionId,
  exercise,
  logged,
  waiting,
  disabled,
  onLogged,
  onRemoved,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  logged: Record<number, { weight: number; reps: number }>;
  waiting: Set<string>;
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
          <span
            key={doneCount === rows ? "complete" : "open"}
            className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${doneCount === rows && rows > 0 ? "nav-bounce bg-success text-white" : "bg-canvas text-muted"}`}
          >
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
            queued={waiting.has(`${exercise.exerciseId}:${n}`)}
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
  queued,
  disabled,
  onLogged,
  onRemoved,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  setNumber: number;
  logged?: { weight: number; reps: number };
  queued: boolean;
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
  // Pop the check only when it's logged now, not for sets loaded with the page.
  const [justDone, setJustDone] = useState(false);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (done) {
        const removeOffline = () => queue({ kind: "remove_set", sessionId, exerciseId: exercise.exerciseId, setNumber });
        if (offline) await removeOffline();
        else {
          try {
            await removeSet(sessionId, exercise.exerciseId, setNumber);
          } catch (e) {
            if (!isOfflineError(e)) throw e;
            await removeOffline();
          }
        }
        onRemoved(setNumber);
        return;
      }
      const w = Number(weight.replace(",", ".") || "0");
      const r = Number(reps);
      if (!Number.isFinite(w) || w < 0 || w > 1000) return setError("Check the weight.");
      if (!Number.isInteger(r) || r < 0 || r > 500) return setError("Check the reps.");
      // No connection: saved on the phone, sent later (a record shows then).
      const saveOffline = async () => {
        await queue({ kind: "set", sessionId, exerciseId: exercise.exerciseId, setNumber, weightKg: w, reps: r });
        return { ok: true, pr: false };
      };
      let res: { ok: boolean; pr: boolean; error?: string };
      if (offline) res = await saveOffline();
      else {
        try {
          res = await logSet(sessionId, exercise.exerciseId, setNumber, w, r);
        } catch (e) {
          if (!isOfflineError(e)) throw e;
          res = await saveOffline();
        }
      }
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else {
        setJustDone(true);
        navigator.vibrate?.(res.pr ? [30, 50, 80] : 15);
        onLogged(setNumber, { weight: w, reps: r }, res.pr);
      }
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
          className={`grid h-10 place-items-center rounded-lg transition-colors ${done ? `bg-success text-white ${justDone ? "check-pop" : ""}` : "bg-canvas text-muted hover:bg-line"}`}
        >
          <Check className="size-5" />
        </button>
      </div>
      {queued && done && (
        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted">
          <CloudUpload className="size-3" /> Saved on your phone, waiting to sync
        </p>
      )}
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
    <div className="bg-ink text-white">
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
