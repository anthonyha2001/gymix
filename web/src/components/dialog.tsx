"use client";

import { createContext, use, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { showToast } from "@/components/toaster";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "lg" | "xl";

// Closes the surrounding dialog, optionally confirming with a toast.
const CloseDialog = createContext<((message?: string) => void) | null>(null);

// Controlled modal (native <dialog>). Content mounts only while open, so forms
// start fresh every time.
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set when the dialog is closed by unmounting/hiding rather than by the user,
  // so the resulting "close" event isn't reported as the user closing it.
  const silentClose = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (open && el && !el.open) el.showModal();
    if (!open && el?.open) el.close();
    // Next keeps hidden copies of recent pages; a modal left open there would
    // block the visible page, so close it whenever this one is hidden.
    return () => {
      if (el?.open) {
        silentClose.current = true;
        el.close();
      }
    };
  }, [open]);

  function handleNativeClose() {
    if (silentClose.current) {
      silentClose.current = false;
      return;
    }
    onClose();
  }

  function close(message?: string) {
    if (message) showToast(message);
    onClose();
  }

  const width = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];

  return (
    <dialog
      ref={ref}
      onClose={handleNativeClose}
      // A click on the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className={`m-0 mt-auto max-h-[92vh] w-full max-w-none overflow-hidden rounded-t-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/50 sm:m-auto sm:rounded-2xl ${width}`}
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">
            <CloseDialog value={close}>{children}</CloseDialog>
          </div>
        </div>
      )}
    </dialog>
  );
}

// A button that opens a modal dialog.
export function Dialog({
  label,
  icon,
  title,
  description,
  children,
  variant = "primary",
  triggerClassName = "",
  unstyledTrigger = false,
  size = "md",
}: {
  label: ReactNode;
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: Variant;
  triggerClassName?: string;
  // Use the label as-is (e.g. a tappable card) instead of a button style.
  unstyledTrigger?: boolean;
  size?: Size;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={unstyledTrigger ? triggerClassName : buttonClass(variant, triggerClassName)}
      >
        {icon}
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} size={size}>
        {children}
      </Modal>
    </>
  );
}

// useActionState that closes the surrounding dialog when the action succeeds
// (confirming with its success message). Outside a dialog it behaves exactly
// like useActionState.
export function useDialogAction(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  initial: ActionState,
) {
  const close = use(CloseDialog);
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.success && close) close(result.success);
    return result;
  }, initial);
}
