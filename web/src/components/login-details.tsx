"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { whatsappUrl } from "@/lib/invite-link";

export function loginMessage(o: { firstName: string; gymName: string; loginId: string; code: string; password: string; loginUrl: string }) {
  return (
    `Hi ${o.firstName}, here is your ${o.gymName} member app login.\n\n` +
    `Log in with: ${o.loginId}\n` +
    (o.loginId !== o.code ? `(or your member code ${o.code})\n` : "") +
    `Password: ${o.password}\n\n` +
    `${o.loginUrl}`
  );
}

// Login, member code and password, with copy and WhatsApp buttons.
export function LoginDetails({
  loginId,
  code,
  password,
  message,
  phone,
}: {
  loginId: string;
  code: string;
  password: string;
  message: string;
  // The member's phone, when staff send it; empty for "send to myself".
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
      <div className="flex flex-wrap gap-2">
        <a href={whatsappUrl(phone, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("whatsapp")}>
          <MessageCircle className="size-4" /> {phone ? "Send on WhatsApp" : "Save to WhatsApp"}
        </a>
        <button type="button" onClick={copy} className={buttonClass("secondary")}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
