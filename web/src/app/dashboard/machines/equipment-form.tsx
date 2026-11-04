"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { FREE_EQUIPMENT } from "@/lib/exercises";
import { setEquipment } from "./actions";

export function EquipmentForm({ selected, counts, canEdit }: { selected: string[]; counts: Record<string, number>; canEdit: boolean }) {
  const [state, action, pending] = useActionState(setEquipment, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FREE_EQUIPMENT.map((eq) => (
          <label
            key={eq.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-canvas"
          >
            <input
              type="checkbox"
              name="equipment"
              value={eq.value}
              defaultChecked={selected.includes(eq.value)}
              disabled={!canEdit}
              className="mt-0.5 size-4 accent-ink"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {eq.label} <span className="font-normal text-muted">· {counts[eq.value] ?? 0} exercises</span>
              </span>
              <span className="block text-xs text-muted">{eq.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save equipment"}
        </Button>
      )}
    </form>
  );
}
