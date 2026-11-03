"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// A one-click action (freeze, void, invite…) with an optional confirm prompt
// and its result shown inline.
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  className = "h-9",
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(async () => action(), {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <button type="submit" disabled={pending} className={buttonClass(variant, className)}>
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {state.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {state.success && <span role="status" className="text-xs text-success">{state.success}</span>}
    </form>
  );
}
