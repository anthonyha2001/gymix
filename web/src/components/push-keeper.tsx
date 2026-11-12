"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshPush } from "@/lib/push/client";

// In the signed-in app: keeps this phone's push subscription saved, and
// refreshes the page (the bell's count) when a push arrives while it's open.
export function PushKeeper() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(refreshPush, 3000);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "push") router.refresh();
      if (e.data?.type === "push-resubscribe") {
        try {
          localStorage.removeItem("gymix:push-saved");
        } catch {}
        refreshPush();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearTimeout(t);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);
  return null;
}
