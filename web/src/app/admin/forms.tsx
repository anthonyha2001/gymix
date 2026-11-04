"use client";

import { useActionState, useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { PRICE_USD } from "@/lib/pricing";
import { savePlatformSettings } from "./actions";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function RecordPaymentForm({ action }: { action: FormAction }) {
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
          <input key={months} name="amount_usd" inputMode="decimal" required defaultValue={months * PRICE_USD} className={inputClass} />
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
