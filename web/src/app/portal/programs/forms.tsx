"use client";

import { useState, useTransition } from "react";
import { useDialogAction } from "@/components/dialog";
import { Repeat, X } from "lucide-react";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Alert, Button, Field, buttonClass, inputClass } from "@/components/ui";
import { EXPERIENCE, GOALS, musclesLabel, type Exercise } from "@/lib/exercises";
import { formatUSD } from "@/lib/format";
import { exerciseAlternatives } from "@/app/exercise-actions";
import { swapExercise } from "@/app/program-actions";
import { createSelfProgram, requestProgram } from "../actions";
import { SearchSelect } from "@/components/search-select";

export function RequestProgramForm({ coaches, price }: { coaches: { id: string; full_name: string }[]; price: number }) {
  const [state, action, pending] = useDialogAction(requestProgram, {});
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your goal">
          <SearchSelect name="goal" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Days per week">
          <SearchSelect name="days_per_week" defaultValue="3" className={inputClass}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "day" : "days"}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Experience">
          <SearchSelect name="experience" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {EXPERIENCE.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Trainer">
          <SearchSelect name="trainer_id" defaultValue="" className={inputClass}>
            <option value="">Any trainer</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || "Trainer"}
              </option>
            ))}
          </SearchSelect>
        </Field>
      </div>
      <Field label="Injuries or pain (optional)">
        <input name="injuries" maxLength={500} placeholder="e.g. lower back pain, left knee surgery last year" className={inputClass} />
      </Field>
      <Field label="Anything else? (optional)">
        <input name="notes" maxLength={1000} placeholder="e.g. I train mornings, 1 hour max" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : price > 0 ? `Request program (${formatUSD(price)})` : "Request program"}
      </Button>
      {price > 0 && <p className="text-xs text-muted">You&apos;ll pay {formatUSD(price)} at the front desk.</p>}
    </form>
  );
}

export function NewSelfProgramForm() {
  const [state, action, pending] = useDialogAction(createSelfProgram, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <input name="name" maxLength={80} placeholder="e.g. My push/pull/legs" aria-label="Program name" className={`${inputClass} min-w-48 flex-1`} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creating…" : "Build my own"}
        </Button>
      </div>
    </form>
  );
}

// "Swap" on a program exercise: shows same-muscle exercises this gym has.
export function SwapButton({ programExerciseId, exerciseId, exerciseName }: { programExerciseId: string; exerciseId: string; exerciseName: string }) {
  const [options, setOptions] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!options) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setOptions(await exerciseAlternatives(exerciseId)))}
        className={buttonClass("secondary", "h-8 px-3 text-xs")}
      >
        <Repeat className="size-3.5" /> {pending ? "Loading…" : "Swap"}
      </button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-2 rounded-lg border border-line bg-canvas p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Swap {exerciseName} for…</p>
        <button type="button" onClick={() => setOptions(null)} aria-label="Close" className="rounded p-1 text-muted hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {options.length === 0 ? (
        <p className="text-sm text-muted">No other exercise for the same muscles on this gym&apos;s machines.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {options.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await swapExercise(programExerciseId, ex.id);
                    if (r.error) setError(r.error);
                    else setOptions(null);
                  })
                }
                className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface p-2 text-left hover:border-ink/40"
              >
                <ExerciseAnimation paths={ex.image_paths} name={ex.name} className="size-12" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{ex.name}</span>
                  <span className="block truncate text-xs text-muted">{musclesLabel(ex.primary_muscles)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
