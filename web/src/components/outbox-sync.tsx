"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { showToast } from "@/components/toaster";
import { flush, list, OUTBOX_EVENT } from "@/lib/outbox";

// The member's main pages, saved on the phone in the background (once every
// 6 hours, online only) so they open offline even if not visited yet.
const WARM = ["/portal", "/portal/train", "/portal/programs", "/portal/schedule", "/portal/progress", "/portal/challenges"];
function warm() {
  try {
    if (navigator.onLine === false || !("serviceWorker" in navigator)) return;
    const last = Number(localStorage.getItem("gymix:warmed") || 0);
    if (Date.now() - last < 6 * 3600_000) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "warm", urls: WARM });
      localStorage.setItem("gymix:warmed", String(Date.now()));
    });
  } catch {
    // Storage blocked: skip.
  }
}

// Online or offline, as the browser reports it (true while rendering on the server).
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );

// Sends what was done offline as soon as the phone is back online (and when
// the app comes back to the screen, and every 20 seconds while something is
// waiting). A small pill above the tab bar says what's waiting.
export function OutboxSync() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  const online = useOnline();
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const count = async () => {
      const n = (await list()).length;
      if (alive) setWaiting(n);
      return n;
    };
    const sync = async () => {
      if (busy.current || navigator.onLine === false || !(await count())) return;
      busy.current = true;
      setSyncing(true);
      const r = await flush();
      busy.current = false;
      if (!alive) return;
      setSyncing(false);
      await count();
      if (r.sent) {
        showToast(`Synced ${r.sent} change${r.sent === 1 ? "" : "s"} from your phone ✓`);
        for (const pr of r.prs) showToast(`New personal record: ${pr}!`);
        router.refresh();
      }
      if (r.failed) showToast(`${r.failed} change${r.failed === 1 ? "" : "s"} couldn't be saved (the workout was removed).`, "error");
    };
    const goOnline = () => sync();
    const onShow = () => document.visibilityState === "visible" && sync();

    sync();
    warm();
    window.addEventListener("online", goOnline);
    window.addEventListener(OUTBOX_EVENT, count);
    document.addEventListener("visibilitychange", onShow);
    const timer = setInterval(sync, 20_000);
    return () => {
      alive = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener(OUTBOX_EVENT, count);
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(timer);
    };
  }, [router]);

  if (online && !waiting) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-bar)+0.75rem)] z-40 flex justify-center px-4">
      <span role="status" className="toast-in flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white shadow-lg">
        {syncing ? (
          <Loader2 className="size-3.5 animate-spin text-brand" />
        ) : online ? (
          <CloudUpload className="size-3.5 text-brand" />
        ) : (
          <CloudOff className="size-3.5 text-brand" />
        )}
        {syncing
          ? "Syncing…"
          : !online
            ? waiting
              ? `Offline · ${waiting} change${waiting === 1 ? "" : "s"} saved on your phone`
              : "Offline · showing what's saved on your phone"
            : `${waiting} change${waiting === 1 ? "" : "s"} waiting to sync`}
      </span>
    </div>
  );
}
