"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, Button, Field, buttonClass, inputClass } from "@/components/ui";
import { formatLBP } from "@/lib/format";
import { PORTAL_PAGES } from "@/lib/portal-pages";
import { saveGymSettings, setPortalPages } from "./actions";

export function SettingsForm({ name, lbpRate, graceDays, reminderDays }: { name: string; lbpRate: number; graceDays: number; reminderDays: number }) {
  const [state, action, pending] = useActionState(saveGymSettings, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gym name">
          <input name="name" required minLength={2} maxLength={80} defaultValue={name} className={inputClass} />
        </Field>
        <Field label="Lira rate (LBP per $1)" hint={`Used when members pay in cash LBP. Now ${formatLBP(lbpRate)}.`}>
          <input name="lbp_rate" inputMode="numeric" required defaultValue={lbpRate} className={inputClass} />
        </Field>
        <Field
          label="Days to pay before freezing"
          hint="A member who still owes money this many days after an invoice is frozen: their app shows only its home page and check-in is refused until they pay."
        >
          <input name="unpaid_grace_days" type="number" min={0} max={60} required defaultValue={graceDays} className={inputClass} />
        </Field>
        <Field
          label="WhatsApp renewal reminder (days before)"
          hint="Members get a WhatsApp message this many days before their membership ends. 0 turns reminders off. See every message sent, and choose the sending number, on the WhatsApp tab."
        >
          <input name="renewal_reminder_days" type="number" min={0} max={30} required defaultValue={reminderDays} className={inputClass} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Check-in link" className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className={buttonClass("secondary", "shrink-0")}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// Switches for the member portal's pages. Home is always on.
export function PortalPagesForm({ hidden }: { hidden: string[] }) {
  const [state, action, pending] = useActionState(setPortalPages, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {PORTAL_PAGES.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3 hover:bg-canvas has-[:checked]:border-ink/40">
              <input type="checkbox" name="page" value={p.id} defaultChecked={!hidden.includes(p.id)} className="mt-1 size-4 accent-ink" />
              <span>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-muted">{p.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {state.success && <span className="text-sm text-success">{state.success}</span>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save pages"}
        </Button>
      </div>
    </form>
  );
}
