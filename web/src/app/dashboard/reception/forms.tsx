"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { AffixInput, ChoiceChips } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { formatLBP, formatUSD, usdToLbp } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const CHANNEL_METHOD: Record<string, string> = { desk: "cash_usd", card_terminal: "card", whish: "whish", omt: "omt", online: "card" };

export function ConfirmForm({ action, amount, channel, lbpRate }: { action: Action; amount: number; channel: string; lbpRate: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [method, setMethod] = useState(CHANNEL_METHOD[channel] ?? "cash_usd");
  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-muted">
        Check you received <b className="text-ink">{formatUSD(amount)}</b>. The membership switches on straight away.
      </p>
      <Field label="Paid by" group>
        <ChoiceChips
          name="method"
          label="Paid by"
          value={method}
          onChange={setMethod}
          options={[
            { value: "cash_usd", label: "Cash $" },
            { value: "cash_lbp", label: "Cash LBP" },
            { value: "card", label: "Card" },
            { value: "whish", label: "Whish" },
            { value: "omt", label: "OMT" },
            { value: "bank_transfer", label: "Bank" },
          ]}
        />
      </Field>
      {method === "cash_lbp" && (
        <Field label="Received in LBP" hint={`${formatLBP(usdToLbp(amount, lbpRate))} at your rate`}>
          <AffixInput prefix="LBP" name="amount_lbp" inputMode="numeric" defaultValue={String(usdToLbp(amount, lbpRate))} />
        </Field>
      )}
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Confirming…" : "Confirm payment"}</Button>
      </div>
    </form>
  );
}

export function KioskForm({ action, initial, submitLabel }: { action: Action; initial?: { name: string; allow_checkin: boolean; allow_join: boolean; allow_buy: boolean }; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={initial?.name} placeholder="e.g. Entrance tablet" className={inputClass} autoFocus />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">People can</legend>
        {[
          ["allow_checkin", "Check in", initial?.allow_checkin ?? true],
          ["allow_buy", "Buy or renew a membership", initial?.allow_buy ?? true],
          ["allow_join", "Join as a new member", initial?.allow_join ?? true],
        ].map(([name, label, on]) => (
          <label key={name as string} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name as string} defaultChecked={on as boolean} className="size-4 accent-ink" /> {label as string}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export function PaymentOptionsForm({ action, whish, omt, terminal }: { action: Action; whish: string | null; omt: string | null; terminal: boolean }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Whish Money number" optional hint="Shown to people paying by Whish.">
          <input name="kiosk_whish_number" defaultValue={whish ?? ""} inputMode="tel" placeholder="e.g. 70 123 456" className={inputClass} />
        </Field>
        <Field label="OMT: send to" optional hint="The name and phone people send OMT payments to.">
          <input name="kiosk_omt_name" defaultValue={omt ?? ""} placeholder="e.g. Maya Saliba, 71 234 567" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="kiosk_card_terminal" defaultChecked={terminal} className="size-4 accent-ink" /> We take cards on a terminal at the desk
      </label>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
