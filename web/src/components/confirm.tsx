"use client";

import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/dialog";
import { Button } from "@/components/ui";

type ConfirmOptions = { title?: string; confirmLabel?: string; danger?: boolean };

// Custom replacement for window.confirm(). Usage:
//   const [confirmDialog, confirm] = useConfirm();
//   if (await confirm("Delete this?", { danger: true })) …
//   return <>{confirmDialog}…</>
export function useConfirm(): [ReactNode, (message: string, options?: ConfirmOptions) => Promise<boolean>] {
  const [state, setState] = useState<(ConfirmOptions & { message: string }) | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  function confirm(message: string, options: ConfirmOptions = {}) {
    setState({ message, ...options });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }

  function finish(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setState(null);
  }

  const danger = state?.danger ?? true;
  // "Cancel" / "Cancel" would be ambiguous when the action itself is a cancel.
  const dismissLabel = /^cancel/i.test(state?.confirmLabel ?? "") ? "Keep it" : "Cancel";
  const dialog = (
    <Modal open={state !== null} onClose={() => finish(false)} title={state?.title ?? "Are you sure?"}>
      {state && (
        <div className="space-y-5">
          <div className="flex gap-3">
            {danger && (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                <AlertTriangle className="size-5" />
              </span>
            )}
            <p className="text-sm">{state.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => finish(false)}>
              {dismissLabel}
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={() => finish(true)}
              className={danger ? "bg-danger text-white hover:bg-danger/90" : ""}
            >
              {state.confirmLabel ?? (danger ? "Yes, continue" : "Confirm")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return [dialog, confirm];
}
