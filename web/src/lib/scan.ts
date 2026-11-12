"use client";

import { isNativeApp, nativePlatform } from "@/lib/native";

// Reading QR codes and barcodes, the fastest way the phone allows:
//   * in the Gymix app: Google ML Kit, on the device (full-screen native
//     scanner; on Android no camera permission is even needed)
//   * in a browser: the camera in a <video>, read by the built-in
//     BarcodeDetector (Chrome, Android) or jsQR (Safari, QR codes only)

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

// QR codes plus the barcodes printed on gym membership cards.
export const MEMBER_CODE_FORMATS = ["qr_code", "code_128", "code_39", "ean_13", "itf"];

// Opens the native scanner and returns what it read (null if cancelled, or
// not in the app). Only call when isNativeApp().
export async function nativeScan(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
  if (nativePlatform() === "android") {
    // Google's code scanner is a small download the first time.
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {});
      return null;
    }
  } else {
    const p = await BarcodeScanner.requestPermissions();
    if (p.camera !== "granted" && p.camera !== "limited") return null;
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Ean13, BarcodeFormat.Itf],
    });
    return barcodes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

export type CameraScan = { stop: () => void; flip: () => Promise<void> };

// Reads codes from the camera into `video` until stopped. `onCode` gets every
// read; repeats of the same code within `quietMs` are skipped.
export async function startCameraScan(
  video: HTMLVideoElement,
  {
    onCode,
    onError,
    facing = "environment",
    formats = ["qr_code"],
    quietMs = 2500,
  }: { onCode: (text: string) => void; onError?: (message: string) => void; facing?: "environment" | "user"; formats?: string[]; quietMs?: number },
): Promise<CameraScan> {
  let stream: MediaStream | null = null;
  let frame = 0;
  let stopped = false;
  let mode = facing;
  let last = { text: "", at: 0 };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  let detector: Detector | null = null;
  if (Ctor) {
    try {
      const supported: string[] = (await (Ctor as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats?.()) ?? formats;
      detector = new Ctor({ formats: formats.filter((f) => supported.includes(f)) });
    } catch {
      detector = null;
    }
  }
  const jsQR = detector ? null : (await import("jsqr")).default;

  async function open() {
    stream?.getTracks().forEach((t) => t.stop());
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("This browser can't use the camera.");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      onError?.(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera access was refused. Allow the camera for Gymix, then try again." : "Couldn't start the camera.");
      return;
    }
    if (stopped) return stream.getTracks().forEach((t) => t.stop());
    video.srcObject = stream;
    await video.play().catch(() => {});
  }

  const tick = async () => {
    if (stopped) return;
    let text: string | null = null;
    if (video.readyState >= 2 && video.videoWidth) {
      if (detector) {
        text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
      } else if (jsQR && ctx) {
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        text = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
      }
    }
    if (text) {
      const now = Date.now();
      if (text !== last.text || now - last.at > quietMs) onCode(text);
      last = { text, at: now };
    }
    frame = requestAnimationFrame(tick);
  };

  await open();
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    },
    async flip() {
      mode = mode === "environment" ? "user" : "environment";
      await open();
    },
  };
}
