"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

// Back to where the member was as soon as the connection returns.
export function OfflineRetry() {
  useEffect(() => {
    const back = () => location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);
  return (
    <div className="relative mt-4 flex flex-wrap justify-center gap-2">
      {/* A plain link to this same address: works even before the app's scripts load. */}
      <a href="" className={buttonClass("primary")}>
        Try again
      </a>
      <a href="/portal" className={buttonClass("secondary")}>
        My saved home
      </a>
    </div>
  );
}
