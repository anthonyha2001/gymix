"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass, inputWidth } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { createTemplate, setProgramPrice } from "./actions";
import { SearchSelect } from "@/components/search-select";

export function StartProgramForm({
  action,
  templates,
  defaultName,
  members,
  submitLabel = "Start building",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  templates: { id: string; name: string }[];
  defaultName: string;
  // When given, the coach picks the member here (starting from the Programs page).
  members?: { id: string; full_name: string }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-3">
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
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Program name">
          <input name="name" defaultValue={defaultName} maxLength={80} className={inputClass} />
        </Field>
        <Field label="Start from">
          <SearchSelect name="template_id" defaultValue="" className={inputClass}>
            <option value="">Blank program</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Template: {t.name}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function NewTemplateForm() {
  const [state, action, pending] = useDialogAction(createTemplate, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Beginner full body, 3 days"
          aria-label="Template name"
          className={`${inputClass} min-w-56 flex-1`}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creating…" : "New template"}
        </Button>
      </div>
    </form>
  );
}

export function ProgramPriceForm({ price }: { price: number }) {
  const [state, action, pending] = useDialogAction(setProgramPrice, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Price of a trainer program (USD)" hint="0 = free. If you charge, the member gets an invoice when they request.">
          <input name="program_price_usd" inputMode="decimal" defaultValue={price} className={inputWidth("w-40")} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
