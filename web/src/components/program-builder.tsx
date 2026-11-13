"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Minus, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Modal } from "@/components/dialog";
import { ExerciseAnimation } from "@/components/exercise-media";
import { ExercisePicker } from "@/components/exercise-picker";
import { ExercisePreview } from "@/components/exercise-preview";
import { showToast } from "@/components/toaster";
import { Alert, Button, buttonClass, inputClass } from "@/components/ui";
import { musclesLabel, type Exercise } from "@/lib/exercises";
import type { ProgramView } from "@/lib/program-shared";
import { saveProgramDraft, type ProgramDraft } from "@/app/program-actions";

// The program editor, used by trainers (any program) and members (their own).
// Everything is edited in the browser, instantly, and saved with one button.
// Unsaved work is kept in this browser, so after a reload or a closed tab it
// can be restored with one tap.

type DraftExercise = {
  key: string;
  id: string | null;
  exercise: { id: string; name: string; imagePaths: string[]; primaryMuscles: string[] };
  sets: number;
  reps: string;
  weight: string;
  rest: number;
  notes: string;
  swappedFromName: string | null;
};
type DraftDay = { key: string; id: string | null; name: string; exercises: DraftExercise[] };
type Draft = { name: string; notes: string; days: DraftDay[] };

const REPS = ["5", "6-8", "8-10", "8-12", "12-15", "15-20"];
const RESTS = [
  { s: 45, label: "45s" },
  { s: 60, label: "1m" },
  { s: 90, label: "1m30" },
  { s: 120, label: "2m" },
  { s: 180, label: "3m" },
];
const LAYOUTS: { label: string; hint: string; days: string[] }[] = [
  { label: "Full body", hint: "3 days", days: ["Full body A", "Full body B", "Full body C"] },
  { label: "Push / Pull / Legs", hint: "3 days", days: ["Push", "Pull", "Legs"] },
  { label: "Upper / Lower", hint: "4 days", days: ["Upper A", "Lower A", "Upper B", "Lower B"] },
  { label: "Start empty", hint: "1 day", days: ["Day 1"] },
];

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

function toDraft(program: ProgramView): Draft {
  return {
    name: program.name,
    notes: program.notes ?? "",
    days: program.days.map((d) => ({
      key: d.id,
      id: d.id,
      name: d.name,
      exercises: d.exercises.map((pe) => ({
        key: pe.id,
        id: pe.id,
        exercise: {
          id: pe.exercise.id,
          name: pe.exercise.name,
          imagePaths: pe.exercise.imagePaths,
          primaryMuscles: pe.exercise.primaryMuscles,
        },
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.targetWeightKg === null ? "" : String(Number(pe.targetWeightKg)),
        rest: pe.restSeconds,
        notes: pe.notes ?? "",
        swappedFromName: pe.swappedFromName,
      })),
    })),
  };
}

// What gets compared to tell whether anything changed (keys are only for React).
const fingerprint = (d: Draft) =>
  JSON.stringify({
    n: d.name,
    o: d.notes,
    d: d.days.map((day) => [day.id, day.name, day.exercises.map((e) => [e.id, e.exercise.id, e.sets, e.reps, e.weight, e.rest, e.notes])]),
  });

const storageKey = (programId: string) => `gymix:program-draft:${programId}`;

function readRaw(programId: string) {
  try {
    return localStorage.getItem(storageKey(programId));
  } catch {
    return null;
  }
}

function forget(programId: string) {
  try {
    localStorage.removeItem(storageKey(programId));
  } catch {}
}

// Unsaved work this browser kept for the same saved version of the program.
function parseStored(raw: string | null, version: string): Draft | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { version: string; draft: Draft };
    return stored.version === version ? stored.draft : null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

export function ProgramBuilder({ program }: { program: ProgramView }) {
  const initial = useMemo(() => toDraft(program), [program]);
  const [base, setBase] = useState(program.updatedAt);
  const [draft, setDraft] = useState<Draft>(initial);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(initial.days[0]?.key ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [confirmDialog, confirm] = useConfirm();

  // A new saved version arrived from the server: start from it.
  if (program.updatedAt !== base) {
    setBase(program.updatedAt);
    setDraft(initial);
    if (!initial.days.some((d) => d.key === dayKey)) setDayKey(initial.days[0]?.key ?? null);
  }

  const dirty = fingerprint(draft) !== fingerprint(initial);

  // Unsaved work left in this browser earlier (none on the server render).
  const storedRaw = useSyncExternalStore(noSubscribe, () => readRaw(program.id), () => null);
  const stored = useMemo(() => parseStored(storedRaw, program.updatedAt), [storedRaw, program.updatedAt]);
  const offerRestore = !dirty && !offerDismissed && stored !== null && fingerprint(stored) !== fingerprint(initial);

  // Keep unsaved work in this browser as it is typed.
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(storageKey(program.id), JSON.stringify({ version: program.updatedAt, draft }));
    } catch {
      // Private mode or storage full: editing still works, it just isn't kept.
    }
  }, [dirty, draft, program.id, program.updatedAt]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const day = draft.days.find((d) => d.key === dayKey) ?? draft.days[0] ?? null;
  const dayIndex = day ? draft.days.indexOf(day) : -1;

  const update = (fn: (d: Draft) => Draft) => {
    setError(null);
    setDraft(fn);
  };
  const updateDay = (key: string, fn: (d: DraftDay) => DraftDay) =>
    update((d) => ({ ...d, days: d.days.map((x) => (x.key === key ? fn(x) : x)) }));
  const updateExercise = (exKey: string, patch: Partial<DraftExercise>) =>
    day && updateDay(day.key, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) }));

  function addDays(names: string[]) {
    const days = names.map((name) => ({ key: newKey(), id: null, name, exercises: [] }));
    update((d) => ({ ...d, days: [...d.days, ...days] }));
    setDayKey(days[0].key);
  }

  function addExercise(ex: Exercise) {
    if (!day) return;
    const item: DraftExercise = {
      key: newKey(),
      id: null,
      exercise: { id: ex.id, name: ex.name, imagePaths: ex.image_paths, primaryMuscles: ex.primary_muscles },
      sets: 3,
      reps: "8-12",
      weight: "",
      rest: 90,
      notes: "",
      swappedFromName: null,
    };
    updateDay(day.key, (d) => ({ ...d, exercises: [...d.exercises, item] }));
    showToast(`${ex.name} added`);
  }

  function moveDay(step: -1 | 1) {
    update((d) => {
      const i = d.days.findIndex((x) => x.key === day?.key);
      const j = i + step;
      if (i < 0 || j < 0 || j >= d.days.length) return d;
      const days = [...d.days];
      [days[i], days[j]] = [days[j], days[i]];
      return { ...d, days };
    });
  }

  function duplicateDay() {
    if (!day) return;
    const copy: DraftDay = {
      key: newKey(),
      id: null,
      name: `${day.name} (copy)`.slice(0, 60),
      exercises: day.exercises.map((e) => ({ ...e, key: newKey(), id: null, swappedFromName: null })),
    };
    update((d) => {
      const days = [...d.days];
      days.splice(dayIndex + 1, 0, copy);
      return { ...d, days };
    });
    setDayKey(copy.key);
  }

  async function deleteDay() {
    if (!day) return;
    const ok =
      day.exercises.length === 0 ||
      (await confirm(`Delete “${day.name}” and its ${day.exercises.length} exercises?`, { danger: true, confirmLabel: "Delete day" }));
    if (!ok) return;
    const next = draft.days[dayIndex + 1] ?? draft.days[dayIndex - 1] ?? null;
    update((d) => ({ ...d, days: d.days.filter((x) => x.key !== day.key) }));
    setDayKey(next?.key ?? null);
  }

  function moveExercise(i: number, step: -1 | 1) {
    if (!day) return;
    updateDay(day.key, (d) => {
      const j = i + step;
      if (j < 0 || j >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { ...d, exercises };
    });
  }

  function save() {
    const payload: ProgramDraft = {
      name: draft.name,
      notes: draft.notes,
      days: draft.days.map((d) => ({
        id: d.id,
        name: d.name,
        exercises: d.exercises.map((e) => ({
          id: e.id,
          exerciseId: e.exercise.id,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          rest: e.rest,
          notes: e.notes,
        })),
      })),
    };
    startSaving(async () => {
      const result = await saveProgramDraft(program.id, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      forget(program.id);
      showToast(result.success ?? "Program saved.");
    });
  }

  const [picking, setPicking] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(draft.notes));
  const totalExercises = draft.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <div className="space-y-5">
      {confirmDialog}
      {offerRestore && stored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-strong/40 bg-brand/20 px-4 py-3 text-sm">
          <span>You have changes from earlier that weren&apos;t saved.</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(stored);
                setDayKey(stored.days[0]?.key ?? null);
              }}
              className={buttonClass("primary", "h-9 px-3")}
            >
              Restore them
            </button>
            <button
              type="button"
              onClick={() => {
                forget(program.id);
                setOfferDismissed(true);
              }}
              className={buttonClass("ghost", "h-9 px-3")}
            >
              Discard
            </button>
          </span>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Name and notes */}
      <div className="space-y-2">
        <input
          value={draft.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          aria-label="Program name"
          maxLength={80}
          placeholder="Program name"
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold tracking-tight outline-none hover:border-line focus:border-ink focus:ring-2 focus:ring-brand"
        />
        {showNotes ? (
          <textarea
            value={draft.notes}
            onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
            maxLength={2000}
            rows={2}
            autoFocus={!draft.notes}
            placeholder="Notes for the whole program, e.g. warm up 10 min on the bike first."
            aria-label="Program notes"
            className={`${inputClass} h-auto py-2`}
          />
        ) : (
          <button type="button" onClick={() => setShowNotes(true)} className="px-2 text-sm text-muted underline underline-offset-4 hover:text-ink">
            Add notes for the whole program
          </button>
        )}
        <p className="px-2 text-xs text-muted">
          {draft.days.length} day{draft.days.length === 1 ? "" : "s"} · {totalExercises} exercise{totalExercises === 1 ? "" : "s"}
        </p>
      </div>

      {draft.days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-5">
          <p className="font-semibold">How is the week split?</p>
          <p className="mt-1 text-sm text-muted">Pick a layout to start with. You can rename, add or remove days after.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => addDays(l.days)}
                className="rounded-xl border border-line bg-surface p-4 text-left transition hover:border-ink/40 hover:shadow-sm"
              >
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-xs text-muted">
                  {l.hint}: {l.days.join(", ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Days */}
          <div role="tablist" aria-label="Training days" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {draft.days.map((d, i) => {
              const on = d.key === day?.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setDayKey(d.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    on ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink"
                  }`}
                >
                  <span className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${on ? "bg-brand text-ink" : "bg-canvas"}`}>{i + 1}</span>
                  <span className="max-w-40 truncate">{d.name || "Untitled day"}</span>
                  <span className={`text-xs ${on ? "text-white/60" : "text-muted"}`}>{d.exercises.length}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => addDays([`Day ${draft.days.length + 1}`])}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-medium text-muted hover:border-ink/40 hover:text-ink"
            >
              <Plus className="size-4" /> Add day
            </button>
          </div>

          {day && (
            <section className="rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <input
                  value={day.name}
                  onChange={(e) => updateDay(day.key, (d) => ({ ...d, name: e.target.value }))}
                  aria-label="Day name"
                  maxLength={60}
                  placeholder="Day name, e.g. Push"
                  className={`${inputClass} h-10 min-w-40 flex-1 font-semibold`}
                />
                <div className="flex items-center gap-1">
                  <IconButton label="Move day earlier" disabled={dayIndex === 0} onClick={() => moveDay(-1)}>
                    <ArrowLeft className="size-4" />
                  </IconButton>
                  <IconButton label="Move day later" disabled={dayIndex === draft.days.length - 1} onClick={() => moveDay(1)}>
                    <ArrowRight className="size-4" />
                  </IconButton>
                  <IconButton label="Duplicate day" onClick={duplicateDay}>
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton label={`Delete ${day.name || "day"}`} danger onClick={deleteDay}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>

              {day.exercises.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-medium">No exercises on this day yet</p>
                  <p className="mt-1 text-sm text-muted">Add them from the machines and equipment your gym has.</p>
                </div>
              ) : (
                <ol className="divide-y divide-line">
                  {day.exercises.map((e, i) => (
                    <ExerciseRow
                      key={e.key}
                      index={i}
                      item={e}
                      first={i === 0}
                      last={i === day.exercises.length - 1}
                      onChange={(patch) => updateExercise(e.key, patch)}
                      onMove={(step) => moveExercise(i, step)}
                      onDuplicate={() =>
                        updateDay(day.key, (d) => {
                          const exercises = [...d.exercises];
                          exercises.splice(i + 1, 0, { ...e, key: newKey(), id: null, swappedFromName: null });
                          return { ...d, exercises };
                        })
                      }
                      onRemove={() => updateDay(day.key, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== e.key) }))}
                    />
                  ))}
                </ol>
              )}

              <div className="border-t border-line p-3">
                <button type="button" onClick={() => setPicking(true)} className={buttonClass("primary", "h-11 w-full")}>
                  <Plus className="size-4" /> Add exercises to {day.name || "this day"}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {day && (
        <Modal open={picking} onClose={() => setPicking(false)} title={`Add to ${day.name || "this day"}`} description="Tap an exercise to add it. Add as many as you like." size="xl" sheet>
          <ExercisePicker source="gym" selectedIds={day.exercises.map((e) => e.exercise.id)} onPick={addExercise} />
          <div className="sticky bottom-0 -mx-5 mt-4 border-t border-line bg-surface/95 px-5 pt-3 backdrop-blur">
            <Button type="button" onClick={() => setPicking(false)} className="w-full">
              Done ({day.exercises.length} on this day)
            </Button>
          </div>
        </Modal>
      )}

      {/* One save for everything, always in reach. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <span className="flex items-center gap-2 text-sm text-muted">
          {dirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500" /> Unsaved changes
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-success" /> All changes saved
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={async () => {
                if (await confirm("Undo every change since the last save?", { danger: true, confirmLabel: "Undo changes" })) {
                  setDraft(initial);
                  forget(program.id);
                  setOfferDismissed(true);
                  setDayKey(initial.days[0]?.key ?? null);
                }
              }}
              className={buttonClass("ghost", "h-10 px-3")}
            >
              <RotateCcw className="size-4" /> Undo
            </button>
          )}
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save program"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={buttonClass("ghost", `h-9 px-2 disabled:opacity-30 ${danger ? "text-muted hover:text-danger" : ""}`)}
    >
      {children}
    </button>
  );
}

function ExerciseRow({
  index,
  item,
  first,
  last,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  item: DraftExercise;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<DraftExercise>) => void;
  onMove: (step: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [showNote, setShowNote] = useState(Boolean(item.notes));
  const [previewing, setPreviewing] = useState(false);
  const chip = (on: boolean) =>
    `rounded-lg border px-2.5 py-1 text-xs font-medium transition ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-canvas text-xs font-bold">{index + 1}</span>
        <div
          onDoubleClick={() => setPreviewing(true)}
          title="Double-click to see it"
          className="flex min-w-0 flex-1 cursor-pointer select-none items-start gap-3"
        >
          <ExerciseAnimation paths={item.exercise.imagePaths} name={item.exercise.name} className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{item.exercise.name}</p>
            <p className="text-xs text-muted">{musclesLabel(item.exercise.primaryMuscles)}</p>
            {item.swappedFromName && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                <Repeat className="size-3" /> Member swapped from {item.swappedFromName}
              </p>
            )}
          </div>
        </div>
        <ExercisePreview exercise={previewing ? item.exercise : null} onClose={() => setPreviewing(false)} />
        <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
          <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label={`Duplicate ${item.exercise.name}`} onClick={onDuplicate}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton label={`Remove ${item.exercise.name}`} danger onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        {/* Sets */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Sets</p>
          <div className="inline-flex items-center rounded-lg border border-line">
            <button type="button" aria-label="Fewer sets" disabled={item.sets <= 1} onClick={() => onChange({ sets: item.sets - 1 })} className="grid size-9 place-items-center text-muted hover:text-ink disabled:opacity-30">
              <Minus className="size-4" />
            </button>
            <span aria-label="Sets" className="w-8 text-center font-semibold tabular-nums">
              {item.sets}
            </span>
            <button type="button" aria-label="More sets" disabled={item.sets >= 20} onClick={() => onChange({ sets: item.sets + 1 })} className="grid size-9 place-items-center text-muted hover:text-ink disabled:opacity-30">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {/* Reps */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Reps</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {REPS.map((r) => (
              <button key={r} type="button" onClick={() => onChange({ reps: r })} className={chip(item.reps === r)}>
                {r}
              </button>
            ))}
            <input
              value={item.reps}
              onChange={(e) => onChange({ reps: e.target.value })}
              aria-label="Reps"
              maxLength={20}
              placeholder="Other"
              className={`${inputClass} h-8 w-20 px-2 text-xs`}
            />
          </div>
        </div>
        {/* Weight */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Weight</p>
          <div className="flex items-center gap-1.5">
            <input
              value={item.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
              inputMode="decimal"
              aria-label="Weight (kg)"
              placeholder="Any"
              className={`${inputClass} h-9 w-20 px-2`}
            />
            <span className="text-xs text-muted">kg</span>
          </div>
        </div>
        {/* Rest */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Rest between sets</p>
          <div className="flex flex-wrap gap-1.5">
            {RESTS.map((r) => (
              <button key={r.s} type="button" onClick={() => onChange({ rest: r.s })} className={chip(item.rest === r.s)}>
                {r.label}
              </button>
            ))}
            {!RESTS.some((r) => r.s === item.rest) && <span className={chip(true)}>{item.rest}s</span>}
          </div>
        </div>
      </div>

      {showNote ? (
        <input
          value={item.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          aria-label="Notes"
          maxLength={300}
          autoFocus={!item.notes}
          placeholder="Tip for this exercise, e.g. slow on the way down"
          className={`${inputClass} h-9`}
        />
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="text-xs text-muted underline underline-offset-4 hover:text-ink">
          Add a tip
        </button>
      )}
    </li>
  );
}
