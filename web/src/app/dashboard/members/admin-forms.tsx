"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { formatUSD } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function RefundForm({ action, amountUsd }: { action: FormAction; amountUsd: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm">
        Refunding <strong>{formatUSD(amountUsd)}</strong> removes this payment, so the invoice is owed again. It&apos;s recorded in the
        activity log with your reason.
      </p>
      <Field label="Reason">
        <input name="reason" required maxLength={200} placeholder="e.g. Member moved abroad" className={inputClass} />
      </Field>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Refunding…" : `Refund ${formatUSD(amountUsd)}`}
      </Button>
    </form>
  );
}

export function AdjustMembershipForm({
  action,
  startsOn,
  endsOn,
  visitLimit,
  visitsUsed,
}: {
  action: FormAction;
  startsOn: string;
  endsOn: string;
  visitLimit: number | null;
  visitsUsed: number;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts on">
          <input name="starts_on" type="date" required defaultValue={startsOn} className={inputClass} />
        </Field>
        <Field label="Ends on">
          <input name="ends_on" type="date" required defaultValue={endsOn} className={inputClass} />
        </Field>
        <Field label="Visit limit" hint="Empty = unlimited">
          <input name="visit_limit" type="number" min={1} defaultValue={visitLimit ?? ""} className={inputClass} />
        </Field>
        <Field label="Visits used">
          <input name="visits_used" type="number" min={0} defaultValue={visitsUsed} className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-muted">Use this to fix a mistake or give a goodwill extension. The change is logged.</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save membership"}
      </Button>
    </form>
  );
}
