"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { SearchSelect } from "@/components/search-select";

// Starts a nutrition plan. With `members`, the dietitian picks who it's for.
export function StartNutritionForm({
  action,
  members,
  submitLabel = "Start the plan",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  members?: { id: string; full_name: string }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {members && (
        <Field label="Member">
          <SearchSelect name="member_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a member
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </SearchSelect>
        </Field>
      )}
      <p className="text-sm text-muted">The plan starts as a draft with breakfast, lunch, a snack and dinner. The member only sees it once you send it.</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
