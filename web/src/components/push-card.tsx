"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, Plus, Share, X } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push/client";
import { sendTestPush } from "@/app/push-actions";

const DISMISS_KEY = "gymix:push-dismissed";

// Turning on notifications for this phone.
//   hero: a dark card on the home page with a live preview of a notification
//         dropping in; hides itself once on, or when dismissed.
//   row:  the switch in Profile → Notifications (and the account page), with
//         "Send me a test".
export function PushCard({ variant = "row", sample = "Your class starts in 1 hour. See you there." }: { variant?: "hero" | "row"; sample?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return variant === "hero" && typeof window !== "undefined" && Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  });
  const [justOn, setJustOn] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [variant]);

  async function turnOn() {
    setBusy(true);
    haptics.tap();
    try {
      const next = await enablePush();
      setState(next);
      if (next === "on") {
        haptics.success();
        setJustOn(true);
        // A real one, straight away, so they see it works.
        await sendTestPush();
      } else if (next === "blocked") haptics.error();
    } catch {
      showToast("Couldn't turn on notifications. Try again.", "error");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setState(await disablePush().catch(() => state));
    setBusy(false);
  }

  if (state === null || state === "unsupported" || state === "not-ready") return null;

  if (variant === "hero") {
    if (dismissed || (state === "on" && !justOn)) return null;
    return (
      <section className="page-enter relative overflow-hidden rounded-3xl bg-ink p-5 text-white">
        <span aria-hidden className="challenge-glow" />
        <button
          type="button"
          aria-label="Not now"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {}
          }}
          className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>

        {/* A notification dropping in, on a loop: what they'll get. */}
        <div aria-hidden className="push-demo relative mx-auto mt-6 mb-5 max-w-xs">
          <div className="push-demo-banner flex items-start gap-2.5 rounded-2xl bg-white/[0.09] p-3 ring-1 ring-white/10 backdrop-blur-md">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand">
              <LogoMark className="size-6 text-ink" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between text-[11px] text-white/50">
                <span className="font-semibold uppercase tracking-wider text-white/70">Gymix</span> now
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-white/90">{sample}</span>
            </span>
          </div>
        </div>

        {state === "on" ? (
          <div className="relative flex items-center gap-3">
            <span className="check-pop grid size-10 place-items-center rounded-full bg-brand text-ink">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <span>
              <span className="block font-semibold">You&apos;re all set</span>
              <span className="text-sm text-white/60">We just sent you a test. Look at the top of your screen.</span>
            </span>
          </div>
        ) : state === "install-first" ? (
          <InstallFirst dark />
        ) : (
          <div className="relative">
            <p className="text-lg font-bold tracking-tight">Never miss a class or a message</p>
            <p className="mt-1 text-sm text-white/60">
              {state === "blocked" ? "Notifications are blocked for Gymix. Turn them on in your phone's settings, then come back." : "Classes, payments, your coach's messages and new challenges, even when the app is closed."}
            </p>
            {state !== "blocked" && (
              <button type="button" onClick={turnOn} disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-ink shadow-[0_10px_30px_-10px_rgb(200_241_53/0.7)] transition active:scale-[0.97] disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="bell-swing size-4" />}
                Turn on notifications
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="rounded-2xl bg-canvas p-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${state === "on" ? "bg-brand text-ink" : "bg-surface text-muted ring-1 ring-line"}`}>
          <BellRing className={`size-5 ${justOn ? "bell-swing" : ""}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Notifications on this phone</span>
          <span className="block text-sm text-muted">
            {state === "on" ? "On. They arrive even when Gymix is closed." : state === "blocked" ? "Blocked. Allow them for Gymix in your phone's settings." : state === "install-first" ? "Add Gymix to your Home Screen first." : "Off"}
          </span>
        </span>
        {(state === "on" || state === "off") && (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="Notifications on this phone"
            disabled={busy}
            onClick={state === "on" ? turnOff : turnOn}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${state === "on" ? "bg-ink" : "bg-line"} disabled:opacity-60`}
          >
            <span className={`absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${state === "on" ? "translate-x-5" : ""}`}>
              {busy ? <Loader2 className="size-3 animate-spin text-muted" /> : state === "on" ? <span className="size-1.5 rounded-full bg-brand" /> : null}
            </span>
          </button>
        )}
      </div>
      {state === "install-first" && (
        <div className="mt-3">
          <InstallFirst />
        </div>
      )}
      {state === "on" && (
        <button
          type="button"
          onClick={async () => {
            haptics.tap();
            const r = await sendTestPush();
            showToast(r.error ?? "Sent. It should pop up in a moment.", r.error ? "error" : undefined);
          }}
          className="mt-3 text-sm font-medium underline underline-offset-4"
        >
          Send me a test
        </button>
      )}
    </div>
  );
}

function InstallFirst({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`relative text-sm ${dark ? "text-white/80" : "text-muted"}`}>
      <p className={dark ? "text-lg font-bold tracking-tight text-white" : "font-medium text-ink"}>On iPhone, add Gymix to your Home Screen</p>
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-center gap-2">
          <span className={`grid size-6 place-items-center rounded-lg ${dark ? "bg-white/10" : "bg-surface ring-1 ring-line"}`}>
            <Share className="size-3.5" />
          </span>
          Tap Share in Safari
        </li>
        <li className="flex items-center gap-2">
          <span className={`grid size-6 place-items-center rounded-lg ${dark ? "bg-white/10" : "bg-surface ring-1 ring-line"}`}>
            <Plus className="size-3.5" />
          </span>
          Add to Home Screen, then open Gymix from there
        </li>
      </ol>
    </div>
  );
}
