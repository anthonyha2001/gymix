"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, RotateCw } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { resendEmail, type ResendState } from "../actions";

const WAIT_SECONDS = 60;

// Sends the email again, then waits a minute before it can be pressed again
// (Supabase refuses faster resends anyway).
export function ResendButton({ email, kind }: { email: string; kind: "signup" | "recovery" }) {
  const [state, action, pending] = useActionState<ResendState>(resendEmail.bind(null, email, kind), {});
  const [now, setNow] = useState(() => Date.now());
  const left = state.sentAt ? Math.max(0, WAIT_SECONDS - Math.floor((now - state.sentAt) / 1000)) : 0;

  useEffect(() => {
    if (!state.sentAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.sentAt]);

  return (
    <form action={action} className="mt-3 space-y-2">
      <button type="submit" disabled={pending || left > 0} className={buttonClass("secondary", "h-10 w-full")}>
        <RotateCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Sending…" : left > 0 ? `Resend email in ${left}s` : "Resend email"}
      </button>
      {state.sentAt && !state.error && (
        <p role="status" className="flex items-center justify-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" /> Sent again. Check your inbox.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-center text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
