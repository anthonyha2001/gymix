"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { startDemo } from "./actions";

// Starts the demo; while the sample gym is being built (a couple of seconds)
// the button shows the logo drawing itself.
export function StartDemoButton() {
  const [state, action, pending] = useActionState(startDemo, {});
  return (
    <form action={action} className="space-y-3">
      <button
        disabled={pending}
        className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-lg font-semibold text-ink shadow-[0_18px_50px_-12px_rgb(200_241_53/0.5)] transition hover:bg-brand-strong disabled:cursor-wait"
      >
        {pending ? (
          <>
            <span className="demo-building grid size-8 place-items-center rounded-[22%] bg-ink text-brand">
              <LogoMark className="size-full" drawable />
            </span>
            Setting up your gym…
          </>
        ) : (
          <>
            Start the demo <ArrowRight className="size-5 transition group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {state.error && <p className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
