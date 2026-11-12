import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { OfflineRetry } from "./retry";

export const metadata: Metadata = { title: "Offline" };

// Shown by the service worker when a page isn't saved on the phone and there's
// no connection. Static: saved when the app is installed.
export default function OfflinePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden bg-ink px-6 py-16 text-center text-white">
      <span aria-hidden className="door-waves">
        <i />
        <i />
        <i />
      </span>
      <span className="relative grid size-20 place-items-center rounded-3xl bg-brand text-ink"><WifiOff className="size-9" strokeWidth={2.25} /></span>
      <h1 className="relative mt-2 text-2xl font-bold">You&apos;re offline</h1>
      <p className="relative max-w-xs text-white/70">
        This page isn&apos;t saved on your phone yet. Pages you&apos;ve opened before still work, and workouts you log offline are sent when you&apos;re back.
      </p>
      <OfflineRetry />
    </main>
  );
}
