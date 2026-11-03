"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

export type MemberDetails = { full_name: string; phone: string | null; email: string | null; notes: string | null };

export function MemberForm({
  action,
  initial,
  submitLabel,
  showInvite = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: MemberDetails;
  submitLabel: string;
  showInvite?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" required minLength={2} maxLength={120} defaultValue={initial?.full_name} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" maxLength={30} defaultValue={initial?.phone ?? ""} placeholder="+961 …" className={inputClass} />
        </Field>
        <Field label="Email (optional)" hint="Needed only for the member portal.">
          <input name="email" type="email" defaultValue={initial?.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Notes (optional)">
          <input name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} placeholder="e.g. knee injury, prefers mornings" className={inputClass} />
        </Field>
      </div>
      {showInvite && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="invite" className="size-4 accent-ink" />
          Invite them to the member portal (they&apos;ll see their membership, invoices and check-in QR)
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
