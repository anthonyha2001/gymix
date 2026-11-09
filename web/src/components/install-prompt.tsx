"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "gymix:install-dismissed";
const WAIT_DAYS = 7;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Boolean(at) && Date.now() - at < WAIT_DAYS * 86400_000;
  } catch {
    return false;
  }
}

// "Install Gymix" popup. Android/Chrome/Edge: one tap installs it. iPhone:
// Safari has no install button for websites, so it shows the two steps.
// Hidden once installed, and for a week after "Not now".
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setOpen(true);
    };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone / iPad Safari: no install event, so show the instructions.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) {
      timer = setTimeout(() => {
        setIos(true);
        setOpen(true);
      }, 1500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "dismissed") dismiss();
    setEvent(null);
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div
      data-install-prompt
      role="dialog"
      aria-label="Install Gymix"
      className="fixed inset-x-3 bottom-[calc(var(--bottom-bar)+0.75rem)] z-[55] mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-xl font-black text-ink">G</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Install the Gymix app</p>
          <p className="text-sm text-muted">Open it from your home screen in one tap, full screen, like any other app.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Close" className="-mt-1 -mr-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas">
          <X className="size-4" />
        </button>
      </div>
      {ios ? (
        <ol className="mt-3 space-y-2 rounded-lg bg-canvas p-3 text-sm">
          <li className="flex items-center gap-2">
            <Share className="size-4 shrink-0" /> Tap <strong>Share</strong> at the bottom of Safari
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus className="size-4 shrink-0" /> Choose <strong>Add to Home Screen</strong>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button onClick={install} className="flex-1">
            <Download className="size-4" /> Install
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
