"use client";

import { useEffect, useRef, useState } from "react";
import { Check, DoorOpen, Loader2, X } from "lucide-react";
import { showToast } from "@/components/toaster";
import { openDoor, openStatus, type OpenState } from "@/app/door-actions";

// Waits for a door opening to be confirmed: asks every half second, for up to
// 15 seconds (after that the opening has expired anyway).
export async function waitForOpen(commandId: number, onState?: (s: OpenState) => void): Promise<OpenState> {
  const until = Date.now() + 16_000;
  let state: OpenState = "waiting";
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 500));
    state = await openStatus(commandId);
    onState?.(state);
    if (state === "opened" || state === "failed") return state;
  }
  return state;
}

type Phase = "idle" | "opening" | "sent" | "opened" | "failed";

const LABEL: Record<Phase, string> = {
  idle: "Open door",
  opening: "Opening…",
  sent: "Opening…",
  opened: "Opened",
  failed: "Didn't open",
};

// "Open door" for staff: unlocks the door for a few seconds, from anywhere.
export function OpenDoorButton({ deviceId, name, className = "" }: { deviceId: string; name: string; className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  async function press() {
    if (phase === "opening" || phase === "sent") return;
    clearTimeout(reset.current);
    setPhase("opening");
    const r = await openDoor(deviceId);
    if (!r.ok) {
      setPhase("failed");
      showToast(r.error, "error");
    } else {
      const final = await waitForOpen(r.commandId, (s) => s === "sent" && setPhase("sent"));
      if (final === "opened") {
        setPhase("opened");
        navigator.vibrate?.(60);
      } else if (final === "sent") {
        // Delivered, but this device doesn't confirm quickly: most likely open.
        setPhase("opened");
        showToast(`${name}: sent to the door.`);
      } else {
        setPhase("failed");
        showToast(`${name} didn't answer. Is the device online?`, "error");
      }
    }
    reset.current = setTimeout(() => setPhase("idle"), 4000);
  }

  const busy = phase === "opening" || phase === "sent";
  const tone =
    phase === "opened"
      ? "bg-success text-white"
      : phase === "failed"
        ? "bg-danger text-white"
        : "bg-ink text-white hover:bg-ink/90";
  return (
    <button
      type="button"
      onClick={press}
      disabled={busy}
      aria-live="polite"
      aria-label={`${LABEL[phase]}: ${name}`}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-wait ${tone} ${className}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : phase === "opened" ? <Check className="size-4" /> : phase === "failed" ? <X className="size-4" /> : <DoorOpen className="size-4" />}
      {LABEL[phase]}
    </button>
  );
}
