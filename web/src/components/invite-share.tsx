"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { waNumber, whatsappUrl } from "@/lib/invite-link";

// WhatsApp + copy buttons for an invite link.
export function InviteShare({
  url,
  message,
  phone,
  compact = false,
}: {
  url: string;
  message: string;
  phone?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const hasNumber = Boolean(waNumber(phone));

  async function copy(what: "link" | "message") {
    await navigator.clipboard.writeText(what === "link" ? url : message);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappUrl(phone, message)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("whatsapp", compact ? "h-8 px-3 text-xs" : "")}
        >
          <MessageCircle className="size-4" />
          {hasNumber ? "Send on WhatsApp" : "Share on WhatsApp"}
        </a>
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
      {!compact && (
        <p className="break-all font-mono text-xs text-muted">{url}</p>
      )}
    </div>
  );
}
