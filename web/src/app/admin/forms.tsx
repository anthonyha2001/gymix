"use client";

import { useActionState, useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass, inputWidth } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { pruneEvents, savePlatformSettings, savePricing } from "./actions";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function RecordPaymentForm({ action, price }: { action: FormAction; price: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [months, setMonths] = useState(1);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Months paid">
          <input
            name="months"
            type="number"
            min={1}
            max={36}
            required
            value={months}
            onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
            className={inputClass}
          />
        </Field>
        <Field label="Amount received (USD)">
          <input key={months} name="amount_usd" inputMode="decimal" required defaultValue={months * price} className={inputClass} />
        </Field>
      </div>
      <Field label="Paid by">
        <SearchSelect name="method" defaultValue="Whish" aria-label="Paid by">
          <option value="Whish">Whish</option>
          <option value="OMT">OMT</option>
          <option value="Bank transfer">Bank transfer</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Other">Other</option>
        </SearchSelect>
      </Field>
      <Field label="Note" hint="Optional, e.g. a transfer reference.">
        <input name="note" maxLength={200} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}

export function ExtendTrialForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Extra free days">
        <input name="days" type="number" min={1} max={365} required defaultValue={14} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Extend trial"}
      </Button>
    </form>
  );
}

export function PlatformSettingsForm({ instructions, whatsapp }: { instructions: string; whatsapp: string }) {
  const [state, formAction, pending] = useActionState(savePlatformSettings, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="How gyms pay you" hint="Shown to every gym owner on their Subscription tab. Your Whish number, OMT name, bank details…">
        <textarea
          name="payment_instructions"
          rows={4}
          maxLength={1000}
          defaultValue={instructions}
          placeholder={"Whish: 71 000 000 (Gymix)\nOMT: send to ...\nThen message us on WhatsApp with your gym name."}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Field label="Your WhatsApp number" hint="Owners get a button that opens a chat with you, naming their gym.">
        <input name="whatsapp" inputMode="tel" defaultValue={whatsapp} placeholder="+961 71 000 000" className={inputClass} />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {state.success && <span className="text-sm text-success">{state.success}</span>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function PricingForm({ priceUsd, trialDays, graceDays }: { priceUsd: number; trialDays: number; graceDays: number }) {
  const [state, formAction, pending] = useActionState(savePricing, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price per gym (USD / month)">
          <input name="price_usd" inputMode="decimal" required defaultValue={priceUsd} className={inputClass} />
        </Field>
        <Field label="Free trial (days)" hint="For gyms created from now on.">
          <input name="trial_days" type="number" min={0} max={365} required defaultValue={trialDays} className={inputClass} />
        </Field>
        <Field label="Grace period (days)" hint="After it ends, before the dashboard locks.">
          <input name="grace_days" type="number" min={0} max={60} required defaultValue={graceDays} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {state.success && <span className="text-sm text-success">{state.success}</span>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save pricing"}
        </Button>
      </div>
    </form>
  );
}

export function SuspendForm({ action, suspend }: { action: FormAction; suspend: boolean }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {suspend ? (
        <Field label="Reason" hint="Optional. Only super admins see it.">
          <input name="reason" maxLength={300} placeholder="e.g. Unpaid since March" className={inputClass} />
        </Field>
      ) : (
        <p className="text-sm text-muted">Their staff dashboard opens again straight away.</p>
      )}
      <Button type="submit" variant={suspend ? "danger" : "primary"} disabled={pending} className="w-full">
        {pending ? "Saving…" : suspend ? "Suspend gym" : "Reopen gym"}
      </Button>
    </form>
  );
}

export function PruneForm() {
  const [state, formAction, pending] = useActionState(pruneEvents, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Field label="Keep the last (days)">
        <input name="keep_days" type="number" min={7} max={3650} required defaultValue={90} className={inputWidth("w-32")} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Cleaning…" : "Delete older events"}
      </Button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
      {state.success && <span className="text-sm text-success">{state.success}</span>}
    </form>
  );
}
