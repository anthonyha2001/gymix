// Sends a browser error to /api/report-error for the super admin dashboard.
// At most 10 reports per page load, and each distinct message only once.
const sent = new Set<string>();

export function reportClientError(error: unknown) {
  try {
    // Errors from the server arrive with a digest; they were already recorded there.
    if (typeof error === "object" && error !== null && "digest" in error && error.digest) return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const message = `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message || "Unknown error"}`.slice(0, 500);
    if (sent.has(message) || sent.size >= 10) return;
    sent.add(message);
    const body = JSON.stringify({ message, stack: err.stack?.slice(0, 4000), path: window.location.pathname });
    if (navigator.sendBeacon?.(`/api/report-error`, new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/report-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // Reporting must never cause another error.
  }
}
