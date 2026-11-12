"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { isNativeApp } from "@/lib/native";
import { nativeScan } from "@/lib/scan";

// Paths a Gymix QR code can point to: a machine (/m/<id>) or the entrance (/c/<token>).
const GYMIX_PATH = /^\/(m|c)\/[A-Za-z0-9-]+\/?$/;

// What a scanned code opens, or null if it isn't a Gymix code. The sticker may
// have been printed from another address of the same gym (e.g. before going
// live), so only the path is used.
export function gymixPathFrom(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return GYMIX_PATH.test(url.pathname) ? url.pathname : null;
  } catch {
    return null;
  }
}

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

// Header button + camera sheet for members whose phone can't read NFC: point it
// at the QR code on a machine or at the entrance.
export function QrScanButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          // In the app: the phone's own fast scanner, full screen.
          if (isNativeApp()) {
            const text = await nativeScan();
            const path = text ? gymixPathFrom(text) : null;
            if (path) {
              haptics.success();
              router.push(path);
            } else if (text) showToast("That isn't a Gymix code. Scan the code on a machine or at the entrance.", "error");
            return;
          }
          setOpen(true);
        }}
        aria-label="Scan a QR code"
        title="Scan a machine or check-in QR code"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        <ScanLine className="size-5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan a QR code" description="Point your camera at the code on a machine or at the entrance." sheet>
        <Scanner onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function Scanner({ onDone }: { onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"starting" | "scanning" | "found" | "error">("starting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastWrong = "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("This browser can't use the camera. Open Gymix in Chrome or Safari.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (e) {
        setStatus("error");
        setMessage(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access was refused. Allow the camera for this site in your browser settings, then try again."
            : "Couldn't start the camera.",
        );
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const el = video.current!;
      el.srcObject = stream;
      await el.play().catch(() => {});
      setStatus("scanning");

      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        let text: string | null = null;
        if (el.readyState >= 2) {
          if (detector) {
            text = (await detector.detect(el).catch(() => []))[0]?.rawValue ?? null;
          } else if (jsQR && ctx && el.videoWidth) {
            // Downscale: jsQR is fast enough at ~640px and much slower at full camera size.
            const scale = Math.min(1, 640 / el.videoWidth);
            canvas.width = Math.round(el.videoWidth * scale);
            canvas.height = Math.round(el.videoHeight * scale);
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
        }
        if (text) {
          const path = gymixPathFrom(text);
          if (path) {
            stopped = true;
            navigator.vibrate?.(60);
            setStatus("found");
            onDone();
            router.push(path);
            return;
          }
          if (text !== lastWrong) {
            lastWrong = text;
            setMessage("That isn't a Gymix code. Scan the code on a machine or at the entrance.");
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDone, router]);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-ink">
        <video ref={video} playsInline muted className="size-full object-cover" aria-label="Camera" />
        {status !== "error" && (
          <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-[3px] border-brand shadow-[0_0_0_9999px_rgba(13,17,23,0.45)]">
            {status === "scanning" && <span className="scan-line absolute inset-x-3 h-0.5 rounded-full bg-brand" />}
          </div>
        )}
        {status === "starting" && <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/80">Starting camera…</p>}
      </div>
      {message && (
        <p role={status === "error" ? "alert" : "status"} className={`text-center text-sm ${status === "error" ? "text-danger" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
