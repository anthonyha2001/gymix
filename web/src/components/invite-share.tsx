"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { WhatsAppSendButton } from "@/components/whatsapp-send";
import type { ActionState } from "@/lib/action-result";

// Send-on-WhatsApp (through Gymix, no phone needed) and copy buttons for an
// invite link. `send` is left out where WhatsApp isn't available (not set up,
// or a staff invite with no phone number): copying still works.
export function InviteShare({
  url,
  message,
  send,
  phone,
  compact = false,
}: {
  url: string;
  message: string;
  send?: () => Promise<ActionState>;
  phone?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function copy(what: "link" | "message") {
    await navigator.clipboard.writeText(what === "link" ? url : message);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {send && <WhatsAppSendButton send={send} compact={compact} disabledReason={phone ? undefined : "Add their phone number to send it on WhatsApp."} />}
        <button type="button" onClick={() => copy("link")} className={buttonClass("secondary", compact ? "h-8 px-3 text-xs" : "")}>
          {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        {!compact && (
          <button type="button" onClick={() => copy("message")} className={buttonClass("ghost")}>
            {copied === "message" ? "Message copied" : "Copy full message"}
          </button>
        )}
      </div>
      {!compact && <p className="break-all font-mono text-xs text-muted">{url}</p>}
    </div>
  );
}
