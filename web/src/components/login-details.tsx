"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { WhatsAppSendButton } from "@/components/whatsapp-send";
import type { ActionState } from "@/lib/action-result";

export function loginMessage(o: { firstName: string; gymName: string; loginId: string; code: string; password: string; loginUrl: string }) {
  return (
    `Hi ${o.firstName}, here is your ${o.gymName} member app login.\n\n` +
    `Log in with: ${o.loginId}\n` +
    (o.loginId !== o.code ? `(or your member code ${o.code})\n` : "") +
    `Password: ${o.password}\n\n` +
    `${o.loginUrl}`
  );
}

// Login, member code and password, with copy and (when WhatsApp is set up)
// send-on-WhatsApp buttons.
export function LoginDetails({
  loginId,
  code,
  password,
  message,
  send,
  sendLabel,
  phone,
}: {
  loginId: string;
  code: string;
  password: string;
  message: string;
  send?: () => Promise<ActionState>;
  sendLabel?: string;
  phone?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted">Log in with</dt>
          <dd className="font-medium">{loginId}</dd>
        </div>
        {loginId !== code && (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-muted">or member code</dt>
            <dd className="font-mono font-medium">{code}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted">Password</dt>
          <dd data-testid="generated-password" className="font-mono text-base font-semibold tracking-wide">
            {password}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {send && <WhatsAppSendButton send={send} label={sendLabel} disabledReason={phone ? undefined : "No phone number on file, so copy them instead."} />}
        <button type="button" onClick={copy} className={buttonClass("secondary")}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
