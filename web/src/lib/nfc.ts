"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/native";

// Writing a link onto a blank NFC sticker, the way this device allows:
//   * in the Gymix iPhone / Android app: Gymix's own native plugin
//     (GymixNfcPlugin in SceneDelegate.swift, NfcPlugin.java). No other app.
//   * in Chrome on Android: Web NFC.
//   * anywhere else (Safari, computers): not possible.

type NfcBridge = {
  isAvailable(): Promise<{ available: boolean }>;
  writeUrl(o: { url: string }): Promise<void>;
  cancel(): Promise<void>;
};
const GymixNfc = registerPlugin<NfcBridge>("GymixNfc");

type NdefWriter = { write: (msg: { records: { recordType: "url"; data: string }[] }, opts?: { signal?: AbortSignal }) => Promise<void> };

export type NfcSupport = "app" | "web" | "none";

// Older app builds don't have the plugin; they fall back like a browser.
export function nfcSupport(): NfcSupport {
  if (typeof window === "undefined") return "none";
  if (isNativeApp() && Capacitor.isPluginAvailable("GymixNfc")) return "app";
  if ("NDEFReader" in window) return "web";
  return "none";
}

export class NfcWriteError extends Error {
  constructor(
    public kind: "cancelled" | "unavailable" | "disabled" | "permission" | "locked" | "failed",
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<NfcWriteError["kind"], string> = {
  cancelled: "Cancelled.",
  unavailable: "This phone can't write NFC stickers.",
  disabled: "Turn on NFC in your phone's settings, then try again.",
  permission: "NFC permission was refused. Allow it, then try again.",
  locked: "This sticker is locked and can't be written. Use a blank one.",
  failed: "Couldn't write. Hold the phone still, flat on the sticker, and try again.",
};

// Resolves once the sticker holds `url`. Aborting the signal cancels.
export async function writeNfcUrl(url: string, signal?: AbortSignal): Promise<void> {
  const support = nfcSupport();
  if (support === "app") {
    const onAbort = () => void GymixNfc.cancel().catch(() => {});
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await GymixNfc.writeUrl({ url });
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      const kind = (["cancelled", "unavailable", "disabled", "locked"] as const).find((k) => code === k) ?? "failed";
      throw new NfcWriteError(kind, MESSAGES[kind]);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    return;
  }
  if (support === "web") {
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
      await new Reader().write({ records: [{ recordType: "url", data: url }] }, { signal });
    } catch (e) {
      if (signal?.aborted) throw new NfcWriteError("cancelled", MESSAGES.cancelled);
      const name = e instanceof DOMException ? e.name : "";
      const kind = name === "NotAllowedError" ? "permission" : name === "NotSupportedError" ? "disabled" : "failed";
      throw new NfcWriteError(kind, MESSAGES[kind]);
    }
    return;
  }
  throw new NfcWriteError("unavailable", MESSAGES.unavailable);
}

// What to tell someone whose device can't write stickers.
export function nfcUnsupportedHint() {
  const ios = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  return ios
    ? "To write stickers on iPhone, open this page in the Gymix app. Apple only lets apps write NFC, not Safari."
    : "To write stickers, open this page in the Gymix app on your phone (or in Chrome on an Android phone).";
}
