"use client";

import { useEffect } from "react";

// On the login page: forget the pages saved on this phone for offline use,
// so the next person to log in never sees the last person's pages. (Changes
// still waiting to sync are kept; they only sync for their own account.)
export function ForgetOfflinePages() {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget-pages" });
  }, []);
  return null;
}
