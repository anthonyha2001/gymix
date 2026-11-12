"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Dumbbell, HeartPulse, Image as ImageIcon, KeyRound, ListChecks, Loader2, Lock, Receipt, Trash2, X } from "lucide-react";
import { Modal } from "@/components/dialog";
import { buttonClass, inputClass } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { deleteMyAccount } from "./actions";

const HOLD_MS = 1600;
const WORD = "DELETE";

// Deleting the account, in three calm steps: what goes and what the gym keeps,
// typing DELETE, then holding the button down (so it can't happen by a slip).
export function DeleteAccount({ blocker, isMember }: { blocker: string | null; isMember: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"idle" | "deleting" | "deleted">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const ready = typed.trim().toUpperCase() === WORD;

  async function run() {
    setPhase("deleting");
    setError(null);
    const res = await deleteMyAccount(typed);
    if (res.error) {
      haptics.error();
      setError(res.error);
      setPhase("idle");
      return;
    }
    haptics.heavy();
    setPhase("deleted");
    await forgetThisPhone();
    setTimeout(() => router.replace("/goodbye"), 1400);
  }

  const goes = isMember
    ? [
        { icon: Dumbbell, text: "Your workouts, sets and programs" },
        { icon: HeartPulse, text: "Body measurements and nutrition plans" },
        { icon: ListChecks, text: "Challenges and training days" },
        { icon: ImageIcon, text: "Your profile photo" },
        { icon: KeyRound, text: "Your login. You can't sign back in." },
      ]
    : [
        { icon: KeyRound, text: "Your login and your access to every gym" },
        { icon: ImageIcon, text: "Your profile photo" },
      ];

  return (
    <section className="overflow-hidden rounded-3xl border border-danger/25 bg-surface">
      <div className="flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <Trash2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Delete account</h2>
          <p className="mt-0.5 text-sm text-muted">Removes your login and your personal data from Gymix for good.</p>
          {blocker ? (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {blocker}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setStep(1);
                setTyped("");
                setError(null);
                haptics.tap();
              }}
              className={buttonClass("secondary", "mt-4 border-danger/30 text-danger hover:border-danger hover:bg-danger/5")}
            >
              Delete my account
            </button>
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => phase === "idle" && setOpen(false)} title={phase === "deleted" ? "Account deleted" : "Delete your account?"} sheet>
        {phase === "deleted" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="delete-done grid size-20 place-items-center rounded-3xl bg-ink text-brand">
              <Check className="size-10" strokeWidth={3} />
            </span>
            <p className="mt-5 text-lg font-bold">Done. Your account is gone.</p>
            <p className="mt-1 text-sm text-muted">Thanks for training with Gymix.</p>
          </div>
        ) : step === 1 ? (
          <div key="s1" className="delete-step space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-danger">Deleted for good</p>
              <ul className="stagger space-y-1.5">
                {goes.map((g) => (
                  <li key={g.text} className="flex items-center gap-3 rounded-2xl bg-danger/[0.06] px-3.5 py-2.5 text-sm">
                    <g.icon className="size-4 shrink-0 text-danger" />
                    <span className="flex-1">{g.text}</span>
                    <X className="size-4 text-danger/60" />
                  </li>
                ))}
              </ul>
            </div>
            {isMember && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">Your gym keeps</p>
                <div className="flex items-center gap-3 rounded-2xl bg-canvas px-3.5 py-2.5 text-sm">
                  <Receipt className="size-4 shrink-0 text-muted" />
                  <span className="flex-1">Your membership, payments and visits, which it needs for its accounts. Ask the gym if you want those removed too.</span>
                  <Lock className="size-4 shrink-0 text-muted" />
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                Keep my account
              </button>
              <button type="button" onClick={() => setStep(2)} className={buttonClass("primary")}>
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div key="s2" className="delete-step space-y-5">
            <div>
              <label htmlFor="confirm-delete" className="text-sm font-medium">
                Type <b>DELETE</b> to confirm
              </label>
              {/* The word lights up letter by letter as it's typed. */}
              <div aria-hidden className="mt-3 flex justify-center gap-1.5">
                {WORD.split("").map((ch, i) => {
                  const on = typed.toUpperCase()[i] === ch;
                  return (
                    <span
                      key={i}
                      className={`grid size-10 place-items-center rounded-xl text-lg font-black transition-all duration-200 ${on ? "letter-on scale-105 bg-danger text-white shadow-lg shadow-danger/30" : "bg-canvas text-muted/50"}`}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
              <input
                id="confirm-delete"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={typed}
                maxLength={12}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next.length > typed.length) haptics.tick();
                  setTyped(next);
                }}
                className={`${inputClass} mt-3 text-center font-mono text-base tracking-[0.3em] uppercase`}
              />
            </div>
            {error && (
              <p role="alert" className="shake-x rounded-xl bg-danger/10 p-3 text-sm text-danger">
                {error}
              </p>
            )}
            <HoldButton disabled={!ready || phase !== "idle"} busy={phase === "deleting"} onDone={run} />
            <button type="button" onClick={() => setOpen(false)} disabled={phase !== "idle"} className={buttonClass("ghost", "w-full")}>
              Keep my account
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}

// Press and hold to delete: a red fill runs across, with a tick of vibration
// at each quarter. Letting go early springs it back.
function HoldButton({ disabled, busy, onDone }: { disabled: boolean; busy: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const started = useRef(0);
  const quarter = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function start() {
    if (disabled) return;
    started.current = performance.now();
    quarter.current = 0;
    const loop = () => {
      const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
      setProgress(p);
      const q = Math.floor(p * 4);
      if (q > quarter.current) {
        quarter.current = q;
        haptics.tick();
      }
      if (p >= 1) return onDone();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(raf.current);
    if (progress < 1) setProgress(0);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) start();
      }}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-14 w-full touch-none select-none overflow-hidden rounded-2xl bg-ink font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-danger"
        style={{ width: `${progress * 100}%`, transition: progress === 0 ? "width 380ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none" }}
      />
      <span className="relative flex items-center justify-center gap-2">
        {busy ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Deleting…
          </>
        ) : (
          <>
            <Trash2 className={`size-5 ${progress > 0 ? "animate-pulse" : ""}`} />
            {progress > 0 ? "Keep holding…" : "Hold to delete my account"}
          </>
        )}
      </span>
    </button>
  );
}

// Nothing of this account stays on the phone: saved pages, queued changes,
// and app preferences.
async function forgetThisPhone() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget-pages" });
    const { clear } = await import("@/lib/outbox");
    await clear();
    const { disconnectWidget } = await import("@/lib/widget");
    await disconnectWidget();
    for (const k of Object.keys(localStorage)) if (k.startsWith("gymix")) localStorage.removeItem(k);
  } catch {}
}
