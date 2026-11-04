"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { X } from "lucide-react";
import { ExercisePicker } from "@/components/exercise-picker";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { Exercise } from "@/lib/exercises";
import type { ActionState } from "@/lib/action-result";
import { createMachine } from "./actions";

export function NewMachineForm() {
  const [state, action, pending] = useDialogAction(createMachine, {});
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [name, setName] = useState("");

  function toggle(ex: Exercise) {
    const exists = picked.some((p) => p.id === ex.id);
    // Suggest a name from the first exercise picked.
    if (!exists && picked.length === 0 && !name) setName(ex.name);
    setPicked(exists ? picked.filter((p) => p.id !== ex.id) : [...picked, ex]);
  }

  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <section className="space-y-3">
        <h2 className="font-semibold">1. What&apos;s done on this machine?</h2>
        <p className="text-sm text-muted">
          Search the library and pick every exercise members can do on it. Each comes with a how-to animation.
        </p>
        <ExercisePicker source="catalog" selectedIds={picked.map((p) => p.id)} onPick={toggle} pickLabel="Select" />
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p.id} className="flex items-center gap-1 rounded-full bg-ink py-1 pr-1 pl-3 text-sm text-white">
                <input type="hidden" name="exercise_ids" value={p.id} />
                {p.name}
                <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.name}`} className="rounded-full p-1 hover:bg-white/20">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">2. Name it</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Machine name" hint="What your members call it, e.g. “Leg press (Technogym)”.">
            <input name="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Your own photo (optional)" hint="JPG, PNG or WebP, under 5 MB. Shown instead of the library picture.">
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={`${inputClass} pt-2`} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input name="description" maxLength={500} placeholder="e.g. Second floor, next to the mirrors" className={inputClass} />
        </Field>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add machine"}
      </Button>
    </form>
  );
}

export function EditMachineForm({
  action,
  name,
  description,
  hasPhoto,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  description: string | null;
  hasPhoto: boolean;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Machine name">
          <input name="name" required minLength={2} maxLength={80} defaultValue={name} className={inputClass} />
        </Field>
        <Field label={hasPhoto ? "Replace photo" : "Add your own photo"}>
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={`${inputClass} pt-2`} />
        </Field>
      </div>
      <Field label="Notes">
        <input name="description" maxLength={500} defaultValue={description ?? ""} className={inputClass} />
      </Field>
      {hasPhoto && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remove_photo" className="size-4 accent-ink" /> Remove my photo (use the library picture)
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function AddExercisesToMachine({
  selectedIds,
  add,
}: {
  selectedIds: string[];
  add: (exerciseId: string) => Promise<void>;
}) {
  // Shown inside a dialog; each pick is saved right away (selected items are on the machine).
  return (
    <ExercisePicker
      source="catalog"
      selectedIds={selectedIds}
      onPick={(ex) => {
        if (!selectedIds.includes(ex.id)) void add(ex.id);
      }}
    />
  );
}
