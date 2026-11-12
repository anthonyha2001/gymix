"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

// Catches crashes the error pages never see (event handlers, timers, failed
// promises) and reports them to the super admin's crash reports.
export function CrashReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Scripts from other sites only say "Script error." with no details.
      if (!e.error && /^Script error\.?$/.test(e.message)) return;
      reportClientError(e.error ?? e.message, { kind: "uncaught" });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      // Cancelled requests and navigations aren't crashes.
      if (r instanceof DOMException && r.name === "AbortError") return;
      if (r && typeof r === "object" && "digest" in r && String((r as { digest: unknown }).digest).startsWith("NEXT_")) return;
      reportClientError(r, { kind: "promise" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
