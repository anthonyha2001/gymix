"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/dialog";

// Shake the phone (twice, quickly) to bring up today's workout. Works while
// the app is open; iPhones need motion permission once (Profile → Shake to start).
export function ShakeQuickStart({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const peaks = useRef<number[]>([]);
  const last = useRef(0);

  useEffect(() => {
    const enabled = () => {
      try {
        return localStorage.getItem("gymix:shake") !== "off";
      } catch {
        return true;
      }
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      if (!a || !enabled()) return;
      const force = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      // ~9.8 is gravity at rest; a firm shake goes well past 20.
      if (force < 22) return;
      const now = Date.now();
      // Not while typing, and not again right after it opened.
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (now - last.current < 3000) return;
      peaks.current = [...peaks.current.filter((t) => now - t < 900), now];
      // Two separate peaks (a back-and-forth) within 0.9 s.
      if (peaks.current.length >= 2 && peaks.current[peaks.current.length - 1] - peaks.current[0] > 150) {
        peaks.current = [];
        last.current = now;
        navigator.vibrate?.(40);
        setOpen(true);
      }
    };
    window.addEventListener("devicemotion", onMotion);
    // Android sends motion events right away. iPhones only after permission,
    // which must be asked during a tap: ask on the first one (silent once granted).
    const Motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    const ask = () => {
      if (enabled()) Motion?.requestPermission?.().catch(() => {});
    };
    const needsAsk = typeof Motion?.requestPermission === "function";
    if (needsAsk) window.addEventListener("touchend", ask, { once: true });
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      if (needsAsk) window.removeEventListener("touchend", ask);
    };
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Quick start" sheet>
      {children}
    </Modal>
  );
}
