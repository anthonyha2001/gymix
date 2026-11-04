"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

// Last resort when the root layout itself fails: no app styles are loaded here.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f5f2", color: "#0d1117" }}>
        <title>Something went wrong · Gymix</title>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: "center", background: "#fff", border: "1px solid #e2e4de", borderRadius: 24, padding: 32 }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
            <p style={{ color: "#5d6470", fontSize: 14 }}>Gymix couldn&apos;t load. We&apos;ve been notified.</p>
            <button
              onClick={() => retry()}
              style={{ background: "#c8f135", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
