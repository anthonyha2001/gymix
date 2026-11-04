"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" };

// App-wide confirmation toasts. Anything can call showToast(); one <Toaster />
// in the root layout displays them.
export function showToast(message: string, tone: Toast["tone"] = "success") {
  window.dispatchEvent(new CustomEvent("gymix:toast", { detail: { message, tone } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Toasts live in the top layer (a popover) so they show above open dialogs;
  // re-showing puts them above whichever dialog opened last.
  useEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return;
    if (el.matches(":popover-open")) el.hidePopover();
    if (toasts.length > 0) el.showPopover();
  }, [toasts]);

  useEffect(() => {
    function onToast(e: Event) {
      const { message, tone } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    }
    window.addEventListener("gymix:toast", onToast);
    return () => window.removeEventListener("gymix:toast", onToast);
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      aria-live="polite"
      className="pointer-events-none fixed inset-auto bottom-[calc(var(--bottom-bar)+1.5rem)] left-1/2 m-0 flex -translate-x-1/2 flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0"
    >
      {toasts.map((t) => (
        <div key={t.id} role="status" className="toast-in flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {t.tone === "success" ? <CheckCircle2 className="size-4 text-brand" /> : <XCircle className="size-4 text-red-300" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
