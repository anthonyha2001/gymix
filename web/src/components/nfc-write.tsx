"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, Nfc } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { NfcWriteError, nfcSupport, nfcUnsupportedHint, writeNfcUrl, type NfcSupport } from "@/lib/nfc";

// Writes a link onto a blank NFC sticker held against the phone, straight from
// Gymix: in the Gymix app (iPhone and Android) or Chrome on Android.
export function NfcWriteButton({
  url,
  label = "Write to sticker",
  className = "",
  onWritten,
}: {
  url: string;
  label?: string;
  className?: string;
  // Called once the sticker holds the link (e.g. to mark the machine done).
  onWritten?: () => unknown;
}) {
  const support = useSyncExternalStore(() => () => {}, nfcSupport, () => "none" as NfcSupport);
  const [state, setState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  if (support === "none") {
    return <p className={`text-xs text-muted ${className}`}>{nfcUnsupportedHint()}</p>;
  }

  async function write() {
    if (state === "waiting") {
      abort.current?.abort();
      setState("idle");
      return;
    }
    const ctl = new AbortController();
    abort.current = ctl;
    setState("waiting");
    setError("");
    try {
      await writeNfcUrl(url, ctl.signal);
      haptics.success();
      setState("done");
      onWritten?.();
      setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 4000);
    } catch (e) {
      if (ctl.signal.aborted || (e instanceof NfcWriteError && e.kind === "cancelled")) {
        setState("idle");
        return;
      }
      haptics.error();
      setError(e instanceof Error ? e.message : "Couldn't write the sticker. Try again.");
      setState("error");
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <button type="button" onClick={write} className={buttonClass(state === "done" ? "secondary" : "primary", "h-10")}>
        {state === "waiting" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <Nfc className="size-4" />
        )}
        {state === "waiting" ? "Hold the phone on the sticker… (tap to cancel)" : state === "done" ? "Sticker written" : label}
      </button>
      {state === "error" && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
