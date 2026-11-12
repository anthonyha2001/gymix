"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BellRing, Check, Loader2, Moon, Send, UserRoundX } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { ChoiceChips } from "@/components/form-controls";
import { showToast } from "@/components/toaster";
import { inputClass } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { reachOf, saveAutomations, sendAnnouncement, type Audience } from "./actions";

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "members", label: "All members", hint: "With a running membership" },
  { value: "expiring", label: "Ending this week", hint: "Remind them to renew" },
  { value: "inactive", label: "Not seen in 2 weeks", hint: "Bring them back" },
  { value: "staff", label: "Your team", hint: "Owners, managers and staff" },
];

const IDEAS = ["Pool closed tomorrow", "New class: Spinning, Mondays 7 pm", "We're open on the holiday, 8 am to 2 pm", "New machines just arrived"];

// Write once, see it exactly as members will (a phone lock screen preview
// that updates as you type), pick who gets it, send.
export function Composer({ gymName, initialReach }: { gymName: string; initialReach: number }) {
  const [audience, setAudience] = useState<Audience>("members");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reach, setReach] = useState<number | null>(initialReach);
  const [sending, startSend] = useTransition();
  const [sent, setSent] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setReach(null);
    reachOf(audience).then((n) => alive && setReach(n));
    return () => {
      alive = false;
    };
  }, [audience]);

  function send() {
    haptics.tap();
    startSend(async () => {
      const r = await sendAnnouncement({ audience, title, body });
      if (r.error) {
        haptics.error();
        return showToast(r.error, "error");
      }
      haptics.success();
      setSent(Date.now());
      showToast(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}`);
      setTitle("");
      setBody("");
    });
  }

  return (
    <section className="grid gap-6 rounded-3xl border border-line bg-surface p-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Who gets it</p>
          <ChoiceChips name="audience" label="Who gets it" size="lg" columns={2} value={audience} onChange={(v) => setAudience(v as Audience)} options={AUDIENCES} />
        </div>
        <div>
          <label htmlFor="ann-title" className="mb-1.5 block text-sm font-medium">
            Title
          </label>
          <input id="ann-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Pool closed tomorrow" className={inputClass} />
          {!title && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setTitle(idea)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition hover:border-ink/30 hover:text-ink">
                  {idea}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="ann-body" className="mb-1.5 flex justify-between text-sm font-medium">
            Message <span className="font-normal text-muted tabular-nums">{body.length}/300</span>
          </label>
          <textarea id="ann-body" rows={3} value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} placeholder="Optional details" className={`${inputClass} h-auto py-2.5`} />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={sending || title.trim().length < 2 || reach === 0}
          className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-6 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 sm:w-auto"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
          {sending ? "Sending…" : reach === null ? "Send" : `Send to ${reach} ${reach === 1 ? "person" : "people"}`}
        </button>
      </div>

      {/* Exactly what lands on their phones. */}
      <div aria-label="Preview" className="relative mx-auto w-full max-w-[20rem]">
        <div className="announce-phone relative overflow-hidden rounded-[2.4rem] bg-ink p-3 shadow-2xl ring-1 ring-black/10">
          <div className="relative h-[24rem] overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-[#1a2410] via-[#0f141b] to-[#0b0f15] px-3 pt-10">
            <span aria-hidden className="absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
            <p className="text-center text-5xl font-semibold tracking-tight text-white/90 tabular-nums">9:41</p>
            <p className="mb-6 text-center text-xs text-white/50">Thursday</p>
            <div key={sent} className={`announce-banner flex items-start gap-2.5 rounded-2xl bg-white/[0.12] p-3 backdrop-blur-xl ${sent ? "is-sent" : ""}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand">
                <LogoMark className="size-6 text-ink" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between text-[11px] text-white/50">
                  <span className="font-semibold uppercase tracking-wide text-white/70">{gymName}</span> now
                </span>
                <span className="block truncate text-[13px] font-semibold text-white">{title || "Your title"}</span>
                <span className="line-clamp-3 text-[12px] leading-snug text-white/75">{body || "Your message shows here."}</span>
              </span>
            </div>
          </div>
        </div>
        {sent > 0 && (
          <span key={`ok-${sent}`} className="check-pop absolute -top-2 -right-2 grid size-10 place-items-center rounded-full bg-brand text-ink shadow-lg">
            <Check className="size-5" strokeWidth={3} />
          </span>
        )}
      </div>
    </section>
  );
}

// The automatic messages (owners): win-back nudges and the nightly summary.
export function Automations({ winbackDays, dailySummary }: { winbackDays: number | null; dailySummary: boolean }) {
  const [days, setDays] = useState(winbackDays);
  const [summary, setSummary] = useState(dailySummary);
  const [pending, start] = useTransition();

  function save(next: { days: number | null; summary: boolean }) {
    setDays(next.days);
    setSummary(next.summary);
    start(async () => {
      const r = await saveAutomations({ winbackDays: next.days, dailySummary: next.summary });
      showToast(r.error ?? "Saved", r.error ? "error" : undefined);
    });
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas">
            <UserRoundX className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Bring back members who stop coming</h2>
            <p className="text-sm text-muted">A friendly &ldquo;We miss you&rdquo; once a member with a running membership hasn&apos;t come for:</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[null, 7, 10, 14, 21].map((d) => (
            <button
              key={String(d)}
              type="button"
              disabled={pending}
              onClick={() => save({ days: d, summary })}
              className={`h-10 rounded-xl border px-4 text-sm font-medium transition active:scale-95 ${days === d ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}
            >
              {d === null ? "Off" : `${d} days`}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas">
            <Moon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Nightly summary</h2>
            <p className="text-sm text-muted">Each evening, owners and managers get the day in one line: check-ins, money taken, new memberships, and who ends tomorrow.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={summary}
            aria-label="Nightly summary"
            disabled={pending}
            onClick={() => save({ days, summary: !summary })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${summary ? "bg-ink" : "bg-line"}`}
          >
            <span className={`absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${summary ? "translate-x-5" : ""}`}>
              {summary && <span className="size-1.5 rounded-full bg-brand" />}
            </span>
          </button>
        </div>
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
          <BellRing className="size-3.5" /> &ldquo;Today: 84 check-ins · $420 taken · 3 ending tomorrow&rdquo;
        </p>
      </div>
    </section>
  );
}
