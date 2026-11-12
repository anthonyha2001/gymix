// Sends a browser error to /api/report-error for the super admin's crash
// reports. At most 10 reports per page load, and each distinct message once.
// Tagged with where it happened (iPhone app, Android app, installed web app,
// browser) and the app version.
const sent = new Set<string>();

export type CrashPlatform = "ios-app" | "android-app" | "pwa" | "browser";

function platform(): CrashPlatform {
  const html = document.documentElement.classList;
  if (html.contains("in-app")) return html.contains("ios") ? "ios-app" : "android-app";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "browser";
}

export function reportClientError(error: unknown, extra: { kind?: "boundary" | "uncaught" | "promise" } = {}) {
  try {
    // Errors from the server arrive with a digest; they were already recorded there.
    if (typeof error === "object" && error !== null && "digest" in error && error.digest) return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const message = `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message || "Unknown error"}`.slice(0, 500);
    if (sent.has(message) || sent.size >= 10) return;
    sent.add(message);
    const body = JSON.stringify({
      message,
      stack: err.stack?.slice(0, 4000),
      path: window.location.pathname,
      platform: platform(),
      app_version: (window as unknown as { __gymixAppVersion?: string }).__gymixAppVersion ?? null,
      kind: extra.kind ?? "boundary",
    });
    if (navigator.sendBeacon?.(`/api/report-error`, new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/report-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // Reporting must never cause another error.
  }
}
