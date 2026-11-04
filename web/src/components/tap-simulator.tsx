"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Keyboard } from "lucide-react";

// Testing stand-in for the NFC check-in tap: pressing Space twice quickly
// anywhere in the member portal does exactly what tapping the entrance sticker
// does. Only rendered while the gym has the tap simulator switched on.
export function TapSimulator() {
  const lastSpace = useRef(0);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName))) return;
      const now = Date.now();
      if (now - lastSpace.current < 400) {
        e.preventDefault();
        lastSpace.current = 0;
        router.push("/tap");
      } else {
        lastSpace.current = now;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => router.push("/tap")}
      className="flex h-9 items-center gap-2 rounded-lg px-2 text-xs whitespace-nowrap text-muted hover:bg-canvas hover:text-ink sm:px-3"
      title="Simulates tapping the entrance sticker (testing mode)"
    >
      <Keyboard className="size-3.5" />
      <span className="hidden sm:inline">Space × 2 = check-in tap</span>
      <span className="sm:hidden">Tap in</span>
    </button>
  );
}
