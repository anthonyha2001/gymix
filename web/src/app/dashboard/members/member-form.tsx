"use client";

import { useDialogAction } from "@/components/dialog";
import { FormSection } from "@/components/form-controls";
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
  const [state, formAction, pending] = useDialogAction(action, {});
  const hasDetails = Boolean(initial?.email || initial?.notes);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <FormSection title="Member">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input name="full_name" required minLength={2} maxLength={120} autoFocus={!initial} defaultValue={initial?.full_name} placeholder="e.g. Rami Haddad" className={inputClass} />
          </Field>
          <Field label="Phone" hint="Used for WhatsApp invites and to log in.">
            <input name="phone" type="tel" maxLength={30} defaultValue={initial?.phone ?? ""} placeholder="71 123 456" className={inputClass} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="More details" description="Email and notes" optional={!hasDetails}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" optional hint="Only needed if they'll log in with their email.">
            <input name="email" type="email" defaultValue={initial?.email ?? ""} placeholder="name@example.com" className={inputClass} />
          </Field>
          <Field label="Notes" optional>
            <input name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} placeholder="e.g. knee injury, prefers mornings" className={inputClass} />
          </Field>
        </div>
      </FormSection>

      {showInvite && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition has-[:checked]:border-ink has-[:checked]:bg-brand/15">
          <input type="checkbox" name="invite" defaultChecked className="mt-0.5 size-5 accent-ink" />
          <span className="text-sm">
            <span className="block font-semibold">Give them the member app</span>
            <span className="text-muted">You&apos;ll get a personal link to send on WhatsApp right after.</span>
          </span>
        </label>
      )}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
