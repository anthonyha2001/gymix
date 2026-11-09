"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// Sends a WhatsApp message through Gymix (the gym's number or the Gymix
// number) and says how it went, right under the button.
export function WhatsAppSendButton({
  send,
  label = "Send on WhatsApp",
  disabledReason,
  compact = false,
}: {
  send: () => Promise<ActionState>;
  label?: string;
  // Shown instead of sending, e.g. "Add a phone number first".
  disabledReason?: string;
  compact?: boolean;
}) {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const sent = Boolean(result?.success);

  return (
    <div className="contents">
      <button
        type="button"
        disabled={pending || Boolean(disabledReason)}
        title={disabledReason}
        onClick={() => startTransition(async () => setResult(await send()))}
        className={buttonClass("whatsapp", `${compact ? "h-8 px-3 text-xs" : ""} disabled:opacity-60`)}
      >
        {sent ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
        {pending ? "Sending…" : sent ? "Sent" : label}
      </button>
      {(result || disabledReason) && (
        <p role="status" className={`order-last basis-full text-xs ${result?.error ? "text-danger" : result?.success ? "text-success" : "text-muted"}`}>
          {result?.error ?? result?.success ?? disabledReason}
        </p>
      )}
    </div>
  );
}
