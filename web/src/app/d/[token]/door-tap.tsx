"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, DoorOpen, Nfc, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { waitForOpen } from "@/components/open-door-button";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { doorTap, type DoorTapResult } from "@/app/door-actions";
import { locate } from "@/lib/locate";

type Stage = "reading" | "opening" | "open" | "refused" | "failed";

// Opened by tapping a door's NFC sticker. One screen from the tap to the open
// door, so the waves never restart:
//   reading  lime waves burst from the middle the instant the tap is read
//   opening  they keep rippling like a heartbeat, a soft buzz on each wave
//   open     one big wave floods the screen green, a strong double buzz
//   refused  the waves stop, the screen shakes red, one long buzz
export function DoorTap({ token, needsLocation }: { token: string; needsLocation: boolean }) {
  const [result, setResult] = useState<DoorTapResult | null>(null);
  const [stage, setStage] = useState<Stage>("reading");
  const router = useRouter();
  const started = useRef(false);

  // The heartbeat: a soft buzz with every wave while we wait.
  useEffect(() => {
    if (stage !== "reading" && stage !== "opening") return;
    const beat = setInterval(() => haptics.pulse(), 900);
    return () => clearInterval(beat);
  }, [stage]);

  useEffect(() => {
    // Once per tap, even in development's double effects.
    if (started.current) return;
    started.current = true;
    haptics.tap();
    (async () => {
      const r = await doorTap(token, needsLocation ? await locate() : null);
      setResult(r);
      if (!r.ok || !r.allowed || !r.commandId) {
        setStage(r.ok ? "refused" : "failed");
        haptics.error();
        return;
      }
      setStage("opening");
      const final = await waitForOpen(r.commandId);
      if (final === "failed") {
        setStage("failed");
        haptics.error();
        return;
      }
      setStage("open");
      haptics.success();
      setTimeout(() => router.push("/portal/train"), 3200);
    })();
  }, [token, needsLocation, router]);

  const ok = result?.ok ? result : null;
  const firstName = ok?.fullName?.split(" ")[0] ?? "";
  const details = ok
    ? [ok.planName, ok.endsOn && `until ${formatDate(ok.endsOn)}`, ok.visitsLeft !== null && `${ok.visitsLeft} visits left`].filter(Boolean).join(" · ")
    : "";
  const bad = stage === "refused" || stage === "failed";

  return (
    <main
      role="status"
      aria-live="assertive"
      className={`door-stage relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-6 py-16 text-center text-white transition-colors duration-500 ${
        stage === "open" ? "bg-success" : bad ? "door-stage-bad bg-danger" : "bg-ink"
      }`}
    >
      {/* The waves: looping while reading and opening, one flood when open. */}
      {!bad && (
        <span aria-hidden className={`door-waves ${stage === "open" ? "door-waves-done" : ""}`}>
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {stage === "open" && <span aria-hidden className="door-flood" />}

      <div className="relative flex flex-col items-center gap-3">
        <span className={`door-core grid size-24 place-items-center rounded-full ${stage === "open" ? "bg-white text-success" : bad ? "bg-white/15" : "bg-brand text-ink"}`}>
          {stage === "open" ? (
            <Check className="check-pop size-12" strokeWidth={3} />
          ) : bad ? (
            <X className="size-12" strokeWidth={3} />
          ) : stage === "opening" ? (
            <DoorOpen className="door-icon-swing size-11" />
          ) : (
            <Nfc className="size-11" />
          )}
        </span>

        {stage === "reading" && <p className="text-2xl font-semibold">Checking you in…</p>}
        {stage === "opening" && (
          <>
            <p className="text-sm font-medium uppercase tracking-widest text-brand">Opening {ok?.doorName}…</p>
            <p className="text-3xl font-bold">One moment{firstName ? `, ${firstName}` : ""}</p>
          </>
        )}
        {stage === "open" && (
          <>
            <p className="text-sm font-medium uppercase tracking-widest opacity-80">{ok?.doorName} is open</p>
            <p className="text-4xl font-bold">Go ahead{firstName ? `, ${firstName}` : ""}</p>
            {details && <p className="text-base opacity-90">{details}</p>}
            <Link href="/portal/train" className={buttonClass("secondary", "mt-4 h-12 px-8 text-base")}>
              Start training
            </Link>
          </>
        )}
        {stage === "refused" && (
          <>
            <p className="text-3xl font-bold">Door stays closed</p>
            {ok?.fullName && <p className="text-lg font-medium">{ok.fullName}</p>}
            <p className="max-w-xs text-base opacity-90">{ok?.reason ?? "Not allowed in"}. Please see the front desk.</p>
          </>
        )}
        {stage === "failed" && (
          <>
            <p className="text-3xl font-bold">{result && !result.ok ? "Couldn't open the door" : "The door didn't answer"}</p>
            <p className="max-w-xs text-base opacity-90">
              {result && !result.ok ? result.error : `You're checked in, but ${ok?.doorName ?? "the door"} didn't open. Tap again, or ask the front desk.`}
            </p>
          </>
        )}
        {bad && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {stage === "failed" && (
              <button type="button" onClick={() => location.reload()} className={buttonClass("secondary")}>
                Try again
              </button>
            )}
            <Link href="/portal" className={buttonClass("secondary")}>
              Go to my portal
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
