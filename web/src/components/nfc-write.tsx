"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, Nfc } from "lucide-react";
import { buttonClass } from "@/components/ui";

// Web NFC (Chrome on Android). Not in TypeScript's DOM types yet.
type NdefWriter = { write: (msg: { records: { recordType: "url"; data: string }[] }, opts?: { signal?: AbortSignal }) => Promise<void> };
declare global {
  interface Window {
    NDEFReader?: new () => NdefWriter;
  }
}

const canWrite = () => typeof window !== "undefined" && "NDEFReader" in window;

// Writes a link onto a blank NFC sticker held against the phone, so no other
// app is needed. Only Chrome on Android allows this; elsewhere it explains why.
export function NfcWriteButton({ url, label = "Write to sticker", className = "" }: { url: string; label?: string; className?: string }) {
  const supported = useSyncExternalStore(() => () => {}, canWrite, () => false);
  const [state, setState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  if (!supported) {
    return (
      <p className={`text-xs text-muted ${className}`}>
        To write stickers straight from Gymix, open this page in Chrome on an Android phone. On iPhone, use the free NFC Tools app
        with the link.
      </p>
    );
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
      const Reader = window.NDEFReader!;
      await new Reader().write({ records: [{ recordType: "url", data: url }] }, { signal: ctl.signal });
      navigator.vibrate?.(80);
      setState("done");
      setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 4000);
    } catch (e) {
      if (ctl.signal.aborted) return;
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "NFC permission was refused. Allow it for this site and try again."
          : name === "NotSupportedError"
            ? "Turn on NFC in your phone's settings and try again."
            : "Couldn't write the sticker. Hold the phone still on it and try again.",
      );
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
