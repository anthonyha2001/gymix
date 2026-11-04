"use client";

import { startTransition, useActionState } from "react";
import { useConfirm } from "@/components/confirm";
import { showToast } from "@/components/toaster";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// A one-click action (freeze, void, invite…) with an optional custom
// confirmation. Success shows as a toast (the button may disappear once the
// action is done); errors show inline.
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirm: confirmMessage,
  className = "h-9",
  icon,
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
  className?: string;
  // Icon-only button: the label becomes its accessible name and tooltip.
  icon?: React.ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(async () => {
    const result = await action();
    if (result.success) showToast(result.success);
    return result;
  }, {});
  const [confirmDialog, confirm] = useConfirm();

  async function onClick() {
    if (confirmMessage && !(await confirm(confirmMessage, { danger: variant === "danger" || variant === "ghost", confirmLabel: label }))) {
      return;
    }
    startTransition(() => dispatch());
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={icon ? label : undefined}
        title={icon ? label : undefined}
        className={buttonClass(variant, className)}
      >
        {icon ? icon : pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {state.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {confirmDialog}
    </div>
  );
}
