"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { submitRequest } from "./actions";

const SIZES = [
  { value: "<50", label: "Under 50" },
  { value: "50-150", label: "50 to 150" },
  { value: "150-400", label: "150 to 400" },
  { value: "400+", label: "400+" },
];

const field =
  "h-12 w-full rounded-2xl bg-white/[0.06] px-4 text-white ring-1 ring-white/10 transition outline-none placeholder:text-white/30 focus:bg-white/[0.09] focus:ring-2 focus:ring-brand";

export function RequestForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [members, setMembers] = useState("50-150");

  if (done) {
    return (
      <div className="page-enter rounded-[2rem] bg-white/[0.05] p-8 text-center ring-1 ring-white/10 backdrop-blur">
        <span className="check-pop mx-auto grid size-20 place-items-center rounded-3xl bg-brand text-ink shadow-[0_20px_60px_-15px_rgb(200_241_53/0.7)]">
          <Check className="size-10" strokeWidth={3} />
        </span>
        <h2 className="mt-6 text-2xl font-black tracking-tight">Request received</h2>
        <p className="mt-2 text-white/60">Thanks, {done}. We&apos;ll message you on WhatsApp, usually within a few hours, with how to pay and get started.</p>
      </div>
    );
  }

  return (
    <form
      className="page-enter space-y-4 rounded-[2rem] bg-white/[0.05] p-6 ring-1 ring-white/10 backdrop-blur sm:p-8"
      action={(fd) => {
        setError(null);
        start(async () => {
          const r = await submitRequest(fd);
          if (r.error) {
            haptics.error();
            setError(r.error);
          } else {
            haptics.success();
            setDone(String(fd.get("owner_name") ?? "").split(" ")[0] || "there");
          }
        });
      }}
    >
      <h2 className="text-xl font-bold">Your gym</h2>
      <input name="gym_name" required minLength={2} maxLength={80} placeholder="Gym name" aria-label="Gym name" className={field} />
      <input name="city" maxLength={80} placeholder="City or area" aria-label="City or area" className={field} />
      <div>
        <p className="mb-2 text-sm text-white/60">Members</p>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setMembers(s.value)}
              className={`h-11 rounded-xl text-xs font-semibold transition active:scale-95 ${members === s.value ? "bg-brand text-ink" : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:text-white"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="members" value={members} />
      </div>
      <h2 className="pt-2 text-xl font-bold">You</h2>
      <input name="owner_name" required minLength={2} maxLength={80} placeholder="Your name" aria-label="Your name" autoComplete="name" className={field} />
      <input name="phone" required type="tel" inputMode="tel" maxLength={30} placeholder="WhatsApp number" aria-label="WhatsApp number" autoComplete="tel" className={field} />
      <input name="email" required type="email" maxLength={120} placeholder="Email" aria-label="Email" autoComplete="email" className={field} />
      <textarea name="message" maxLength={1000} rows={2} placeholder="Anything we should know? (optional)" aria-label="Message" className={`${field} h-auto py-3`} />
      {error && (
        <p role="alert" className="shake-x rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        data-track="Request access (form)"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-ink shadow-[0_14px_40px_-14px_rgb(200_241_53/0.8)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        {pending ? "Sending…" : "Request access"}
      </button>
      <p className="text-center text-xs text-white/40">We only use these details to contact you about Gymix.</p>
    </form>
  );
}
