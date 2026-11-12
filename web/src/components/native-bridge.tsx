"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp, nativePlatform } from "@/lib/native";

// Glue between the website and the iPhone / Android app. Does nothing in a
// browser. In the app it:
//   * marks <html class="in-app ios|android"> so CSS can adapt (no install banner)
//   * opens Gymix links (door stickers, invites) inside the app when tapped
//   * makes Android's back button go back, or leave the app from the first page
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("in-app", nativePlatform());
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { App } = await import("@capacitor/app");
      const opened = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.host === location.host) router.push(`${u.pathname}${u.search}${u.hash}`);
        } catch {
          // Not a link we know.
        }
      });
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        // An open dialog or sheet closes first (it listens for Escape).
        const dialog = document.querySelector("dialog[open]");
        if (dialog) {
          dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          (dialog as HTMLDialogElement).close?.();
        } else if (canGoBack) history.back();
        else App.minimizeApp();
      });
      // The app was opened from a link while closed: go there.
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        try {
          const u = new URL(launch.url);
          if (u.host === location.host && u.pathname !== location.pathname) router.replace(`${u.pathname}${u.search}`);
        } catch {
          // Ignore.
        }
      }
      cleanup = () => {
        opened.remove();
        back.remove();
      };
      if (cancelled) cleanup();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
