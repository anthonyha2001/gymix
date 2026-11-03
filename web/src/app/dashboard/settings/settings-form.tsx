"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, Button, Field, buttonClass, inputClass } from "@/components/ui";
import { formatLBP } from "@/lib/format";
import { saveGymSettings } from "./actions";

export function SettingsForm({ name, lbpRate }: { name: string; lbpRate: number }) {
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
