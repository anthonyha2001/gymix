"use client";

import { useActionState, useState, useTransition } from "react";
import { Building2, Check, Smartphone } from "lucide-react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { showToast } from "@/components/toaster";
import { connectWhatsApp, saveWhatsAppAppSecret, setWhatsAppSender } from "./whatsapp-actions";

type SenderOption = { id: "gymix" | "own"; title: string; body: string; status: string; ready: boolean };

// The two sending numbers as large choices; "own" needs a connected number.
export function SenderChooser({ current, gymixReady, ownReady, ownLabel }: { current: "gymix" | "own"; gymixReady: boolean; ownReady: boolean; ownLabel: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options: SenderOption[] = [
    {
      id: "gymix",
      title: "Gymix number",
      body: "Messages come from Gymix's verified WhatsApp number, with your gym's name in every message. Nothing to set up.",
      status: gymixReady ? "Ready" : "Not available yet",
      ready: gymixReady,
    },
    {
      id: "own",
      title: "Your own number",
      body: "Messages come from your gym's WhatsApp Business number and name, through your own Meta WhatsApp API account.",
      status: ownLabel ?? "Not connected",
      ready: ownReady,
    },
  ];

  function choose(id: "gymix" | "own") {
    if (id === current || pending) return;
    setError(null);
    startTransition(async () => {
      const r = await setWhatsAppSender(id);
      if (r.error) setError(r.error);
      else if (r.success) showToast(r.success);
    });
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Sending number" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = o.id === current;
          const Icon = o.id === "gymix" ? Building2 : Smartphone;
          const blocked = o.id === "own" && !o.ready;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending || blocked}
              onClick={() => choose(o.id)}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition ${
                active ? "border-ink bg-surface ring-1 ring-ink" : "border-line bg-surface hover:border-ink/40"
              } disabled:cursor-not-allowed ${blocked ? "opacity-70" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span className={`grid size-8 place-items-center rounded-lg ${active ? "bg-brand" : "bg-canvas"}`}>
                  <Icon className="size-4" />
                </span>
                <span className="font-semibold">{o.title}</span>
                <span className={`ml-auto grid size-5 place-items-center rounded-full border ${active ? "border-ink bg-ink text-white" : "border-line"}`}>
                  {active && <Check className="size-3" />}
                </span>
              </span>
              <span className="text-sm text-muted">{o.body}</span>
              <span className={`text-xs font-medium ${o.ready ? "text-success" : "text-muted"}`}>{o.status}</span>
            </button>
          );
        })}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function ConnectForm({ reconnect = false }: { reconnect?: boolean }) {
  const [state, action, pending] = useActionState(connectWhatsApp, {});
  // Controlled, so a refused attempt keeps what was typed (forms reset after an action).
  const [values, setValues] = useState({ phone_number_id: "", waba_id: "", token: "" });
  const bind = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number ID" hint="WhatsApp Manager → API setup, under your number.">
          <input {...bind("phone_number_id")} inputMode="numeric" required autoComplete="off" placeholder="109876543210987" className={inputClass} />
        </Field>
        <Field label="WhatsApp Business account ID" hint="Shown on the same page, above the phone number.">
          <input {...bind("waba_id")} inputMode="numeric" required autoComplete="off" placeholder="102345678901234" className={inputClass} />
        </Field>
      </div>
      <Field label="Permanent access token" hint="From a system user in Meta Business settings, with the whatsapp_business_messaging and whatsapp_business_management permissions. Kept on the server, never shown again.">
        <input {...bind("token")} type="password" required autoComplete="off" placeholder="EAAG…" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking with Meta…" : reconnect ? "Save new keys" : "Connect my number"}
      </Button>
    </form>
  );
}

export function AppSecretForm({ saved }: { saved: boolean }) {
  const [state, action, pending] = useActionState(saveWhatsAppAppSecret, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="App secret" hint={saved ? "Saved. Paste a new one to replace it, or save it empty to remove it." : "Your Meta app → App settings → Basic → App secret."}>
        <input name="app_secret" type="password" autoComplete="off" placeholder={saved ? "••••••••••••••••" : "32 letters and numbers"} className={inputClass} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
