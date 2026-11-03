"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current page's server data every few seconds (e.g. live check-in feed).
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
