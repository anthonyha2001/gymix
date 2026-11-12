"use client";

import { useEffect } from "react";
import { presencePing } from "@/app/presence-actions";

const EVERY_MS = 10 * 60_000;
// After "not in the gym" or "the gym doesn't use this", ask again much later.
const QUIET_MS = 30 * 60_000;

// Keeps the gym's live count honest: while the member app is open, checks
// every 10 minutes (and when the app comes back to the screen) whether a
// member counted inside is still at the gym. Only in gyms that switched
// "phone must be at the gym" on, only if this phone already allowed location
// for Gymix (it never asks), and never in the background. Nothing on screen.
export function PresenceCheck({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;
    let alive = true;
    let next = 0;
    // Not inside (or the gym doesn't use this): coming back to the app doesn't check again early.
    let quiet = false;

    const allowed = async () => {
      try {
        const p = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        return p?.state === "granted";
      } catch {
        return false;
      }
    };

    const check = async () => {
      if (!alive || document.visibilityState !== "visible" || Date.now() < next || navigator.onLine === false) return;
      if (!(await allowed())) {
        next = Date.now() + QUIET_MS;
        return;
      }
      next = Date.now() + EVERY_MS;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await presencePing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            quiet = r === "not_in" || r === "off" || r === "left";
            if (quiet) next = Date.now() + QUIET_MS;
          } catch {
            // Offline or signed out: try again later.
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
      );
    };

    check();
    const timer = setInterval(check, 60_000);
    const onShow = () => {
      // Back to the app: check now (not waiting for the 10 minutes).
      if (document.visibilityState === "visible") {
        if (!quiet) next = 0;
        check();
      }
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [enabled]);

  return null;
}
