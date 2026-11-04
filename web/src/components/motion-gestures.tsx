"use client";

import { useEffect } from "react";

// One reader of the motion sensor that tells a shake from a drop, so only one
// of them fires. It sends "gymix:shake" (ShakeQuickStart) or "gymix:drop"
// (DropCatch) on window.
//   Drop:  near-zero gravity for 0.2 s or more (free fall), then a hard hit.
//   Shake: three firm back-and-forth peaks within 1.2 s, with no fall. It waits
//          0.4 s before firing, and a drop in that time cancels it.
// After a drop, shakes are ignored for 3 s (picking the phone up); after a
// shake, drops are ignored for 2 s.
const FALL_G = 3;
const FALL_MS = 200;
const HIT_G = 25;
const SHAKE_G = 22;

const shakeEnabled = () => {
  try {
    return localStorage.getItem("gymix:shake") !== "off";
  } catch {
    return true;
  }
};

export function MotionGestures() {
  useEffect(() => {
    let fallStart = 0;
    let fellAt = 0;
    let peaks: number[] = [];
    let pendingShake: ReturnType<typeof setTimeout> | undefined;
    let quietShakeUntil = 0;
    let quietDropUntil = 0;

    const cancelShake = () => {
      clearTimeout(pendingShake);
      pendingShake = undefined;
      peaks = [];
    };

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const g = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      const now = Date.now();

      // Free fall.
      if (g < FALL_G) {
        if (!fallStart) fallStart = now;
        return;
      }
      if (fallStart) {
        if (now - fallStart >= FALL_MS) {
          fellAt = now;
          cancelShake();
        }
        fallStart = 0;
      }

      // The landing after a fall: a drop.
      if (fellAt && now - fellAt < 800) {
        if (g > HIT_G) {
          fellAt = 0;
          cancelShake();
          quietShakeUntil = now + 3000;
          if (now >= quietDropUntil) window.dispatchEvent(new Event("gymix:drop"));
        }
        return;
      }
      fellAt = 0;

      // Shake peaks (samples above the line count once per 120 ms).
      if (g < SHAKE_G || pendingShake || now < quietShakeUntil || !shakeEnabled()) return;
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (peaks.length && now - peaks[peaks.length - 1] < 120) return;
      peaks = [...peaks.filter((t) => now - t < 1200), now];
      if (peaks.length >= 3) {
        peaks = [];
        pendingShake = setTimeout(() => {
          pendingShake = undefined;
          quietShakeUntil = Date.now() + 3000;
          quietDropUntil = Date.now() + 2000;
          window.dispatchEvent(new Event("gymix:shake"));
        }, 400);
      }
    };
    window.addEventListener("devicemotion", onMotion);

    // Android sends motion events right away. iPhones only after permission,
    // which must be asked during a tap: ask on the first one (silent once granted).
    const Motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    const ask = () => {
      Motion?.requestPermission?.().catch(() => {});
    };
    const needsAsk = typeof Motion?.requestPermission === "function";
    if (needsAsk) window.addEventListener("touchend", ask, { once: true });
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      if (needsAsk) window.removeEventListener("touchend", ask);
      clearTimeout(pendingShake);
    };
  }, []);

  return null;
}
