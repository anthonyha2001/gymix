"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { inputClass } from "@/components/ui";
import { sendMessage } from "@/app/chat-actions";

type Message = { id: string; sender_id: string | null; body: string; created_at: string; read_at: string | null };

export function ChatThread({
  conversationId,
  messages,
  meId,
  otherName,
  timeZone,
}: {
  conversationId: string;
  messages: Message[];
  meId: string;
  otherName: string;
  timeZone: string;
}) {
  const [state, send, pending] = useActionState(sendMessage.bind(null, conversationId), {});
  const bottom = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface">
      <AutoRefresh seconds={4} />
      <div className="max-h-[60vh] min-h-64 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Start the conversation with {otherName}.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm bg-canvas text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })}
                  {mine && (m.read_at ? " · Seen" : "")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form action={send} className="flex gap-2 border-t border-line p-3">
        <input
          name="body"
          required
          maxLength={2000}
          autoComplete="off"
          placeholder={`Message ${otherName}…`}
          aria-label="Message"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Send"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink text-brand disabled:opacity-50"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
      {state.error && <p className="px-3 pb-3 text-xs text-danger">{state.error}</p>}
    </div>
  );
}
