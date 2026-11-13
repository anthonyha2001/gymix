"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Copy, Dumbbell, Nfc, Printer, RotateCcw, SkipForward, Smartphone, Wifi } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { setStickerDone } from "../actions";
import { NfcWriteError, nfcSupport, writeNfcUrl } from "@/lib/nfc";

export type StickerMachine = {
  id: string;
  name: string;
  thumb: string | null;
  url: string;
  stickerAt: string | null;
  tappedAt: string | null;
};

type Env = "write" | "ios" | "other";

// Stickers are written in the Gymix app (iPhone and Android) or Chrome on
// Android. Safari can't write NFC, and computers can't at all, so they hand off to
// the phone with a QR code.
function detect(): Env {
  if (nfcSupport() !== "none") return "write";
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
}


const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

export function StickerSetup({ machines, pageUrl, pageQr }: { machines: StickerMachine[]; pageUrl: string; pageQr: string }) {
  const env = useSyncExternalStore(() => () => {}, detect, () => "other" as Env);
  const [, startTransition] = useTransition();
  const [done, setDoneOptimistic] = useOptimistic(
    Object.fromEntries(machines.map((m) => [m.id, Boolean(m.stickerAt)])) as Record<string, boolean>,
    (state, { id, value }: { id: string; value: boolean }) => ({ ...state, [id]: value }),
  );
  const ready = machines.filter((m) => done[m.id]).length;
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const writerRef = useRef<HTMLDivElement>(null);

  // The machine being written: the one picked from the list, else the next
  // one without a sticker.
  const current = useMemo(
    () => machines.find((m) => m.id === chosen) ?? machines.find((m) => !done[m.id] && !skipped.includes(m.id)) ?? null,
    [machines, chosen, done, skipped],
  );

  function mark(id: string, value: boolean) {
    startTransition(async () => {
      setDoneOptimistic({ id, value });
      const res = await setStickerDone(id, value);
      if (res.error) showToast(res.error, "error");
    });
  }

  if (!machines.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-10 text-center">
        <Dumbbell className="mx-auto size-8 text-muted" />
        <p className="mt-3 font-semibold">No machines yet</p>
        <p className="mt-1 text-sm text-muted">Add your machines first, then come back to give each one its sticker.</p>
        <Link href="/dashboard/machines?tab=machines" className={buttonClass("primary", "mt-4")}>
          Add machines
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Progress ready={ready} total={machines.length} />

      {env === "write" && (
        <div ref={writerRef}>
          {current ? (
            <Writer
              key={current.id}
              machine={current}
              position={machines.indexOf(current) + 1}
              total={machines.length}
              isDone={done[current.id]}
              onWritten={() => {
                mark(current.id, true);
                setChosen(null);
              }}
              onSkip={() => {
                setSkipped((s) => [...s, current.id]);
                setChosen(null);
              }}
            />
          ) : (
            <AllDone total={machines.length} onRestart={skipped.length ? () => setSkipped([]) : undefined} />
          )}
        </div>
      )}
      {env === "ios" && <IphoneGuide />}
      {env === "other" && <HandOff pageUrl={pageUrl} pageQr={pageQr} />}

      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-semibold">All machines</h2>
          <a href="/print/machines" target="_blank" rel="noopener" className={buttonClass("secondary", "h-9")}>
            <Printer className="size-4" /> Print QR codes
          </a>
        </div>
        <ul className="divide-y divide-line">
          {machines.map((m) => (
            <Row
              key={m.id}
              machine={m}
              isDone={done[m.id]}
              active={env === "write" && current?.id === m.id}
              env={env}
              onWrite={() => {
                setChosen(m.id);
                writerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onMark={(v) => mark(m.id, v)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Progress({ ready, total }: { ready: number; total: number }) {
  const pct = Math.round((ready / total) * 100);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white">
      <span aria-hidden className="challenge-glow" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Stickers</p>
          <p className="mt-1 text-4xl font-black tabular-nums tracking-tight">
            {ready}
            <span className="text-white/40"> / {total}</span>
          </p>
          <p className="text-sm text-white/70">{ready === total ? "Every machine has its sticker." : `${total - ready} machine${total - ready === 1 ? "" : "s"} still need one.`}</p>
        </div>
        <Nfc className="size-10 text-brand" strokeWidth={1.75} />
      </div>
      <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Android: write the stickers one after the other. One tap per machine.
function Writer({
  machine,
  position,
  total,
  isDone,
  onWritten,
  onSkip,
}: {
  machine: StickerMachine;
  position: number;
  total: number;
  isDone: boolean;
  onWritten: () => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "written" | "error">("idle");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function write() {
    if (phase === "waiting") {
      abort.current?.abort();
      setPhase("idle");
      return;
    }
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase("waiting");
    setError("");
    try {
      await writeNfcUrl(machine.url, ctl.signal);
      haptics.success();
      setPhase("written");
      // Let the tick show, then move on to the next machine.
      setTimeout(onWritten, 1100);
    } catch (e) {
      if (ctl.signal.aborted) return;
      if (e instanceof NfcWriteError && e.kind === "cancelled") {
        setPhase("idle");
        return;
      }
      haptics.error();
      setError(
        e instanceof Error ? e.message : "Couldn't write. Hold the phone still, flat on the sticker, and try again.",
      );
      setPhase("error");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest text-muted">
        <span>
          Machine {position} of {total}
        </span>
        {isDone && phase !== "written" ? <span className="text-success">Has a sticker · writing again</span> : null}
      </div>

      <div className="mt-5 flex flex-col items-center text-center">
        <div className={`nfc-target ${phase === "waiting" ? "is-waiting" : ""} ${phase === "written" ? "is-written" : ""}`}>
          <span aria-hidden className="nfc-ring" />
          <span aria-hidden className="nfc-ring" />
          <span aria-hidden className="nfc-ring" />
          <span className="relative grid size-28 place-items-center overflow-hidden rounded-[2rem] bg-canvas shadow-inner">
            {phase === "written" ? (
              <span className="grid size-full place-items-center bg-brand text-ink">
                <Check className="nfc-check size-12" strokeWidth={3} />
              </span>
            ) : machine.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={machine.thumb} alt="" className="size-full object-cover" />
            ) : (
              <Dumbbell className="size-10 text-muted" />
            )}
          </span>
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">{machine.name}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          {phase === "waiting"
            ? "Hold the top of your phone flat on a blank sticker, and keep it still."
            : phase === "written"
              ? "Sticker written. Stick it on the machine where members can reach it."
              : "Have a blank NFC sticker ready, then tap Write."}
        </p>
        {phase === "error" && (
          <p role="alert" className="mt-3 max-w-xs text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={phase === "written" ? undefined : write}
            aria-disabled={phase === "written"}
            className={buttonClass(phase === "waiting" ? "secondary" : "primary", `h-12 text-base ${phase === "written" ? "pointer-events-none bg-brand text-ink hover:bg-brand" : ""}`)}
          >
            {phase === "waiting" ? (
              <>
                <Wifi className="size-5 rotate-90 animate-pulse" /> Waiting for the sticker… Cancel
              </>
            ) : phase === "written" ? (
              <>
                <CheckCircle2 className="size-5" /> Done
              </>
            ) : (
              <>
                <Nfc className="size-5" /> {phase === "error" ? "Try again" : "Write sticker"}
              </>
            )}
          </button>
          {phase !== "waiting" && phase !== "written" && (
            <button type="button" onClick={onSkip} className={buttonClass("ghost", "h-10 text-muted")}>
              <SkipForward className="size-4" /> Skip this machine
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AllDone({ total, onRestart }: { total: number; onRestart?: () => void }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-8 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand text-ink">
        <Check className="size-8" strokeWidth={3} />
      </span>
      <p className="mt-4 text-xl font-bold">{onRestart ? "That's the list" : `All ${total} machines have a sticker`}</p>
      <p className="mt-1 text-sm text-muted">Tap a sticker with your phone to check it opens the machine. It shows here as working once a member taps it.</p>
      {onRestart && (
        <button type="button" onClick={onRestart} className={buttonClass("secondary", "mt-4")}>
          <RotateCcw className="size-4" /> Go back to the skipped ones
        </button>
      )}
    </div>
  );
}

// iPhone in Safari: Apple only lets apps write NFC, so this page has to be
// opened in the Gymix app, which writes each sticker itself.
function IphoneGuide() {
  const steps = [
    "Open the Gymix app on this iPhone and log in.",
    "Go to Equipment → Set up stickers.",
    "Tap Write sticker and hold the top of the iPhone on a blank sticker.",
  ];
  return (
    <div className="rounded-3xl border border-line bg-surface p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-brand">
          <Smartphone className="size-6" />
        </span>
        <div>
          <h2 className="font-semibold">Write stickers in the Gymix app</h2>
          <p className="text-sm text-muted">Apple lets apps write NFC stickers, but not Safari. In the Gymix app it&apos;s one tap per machine, nothing else to install.</p>
        </div>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 rounded-2xl bg-canvas p-4 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-brand">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Computer: hand off to the phone.
function HandOff({ pageUrl, pageQr }: { pageUrl: string; pageQr: string }) {
  return (
    <div className="grid items-center gap-6 rounded-3xl bg-surface p-6 ring-1 ring-line sm:grid-cols-[1fr_auto]">
      <div>
        <h2 className="text-lg font-semibold">Stickers are written with a phone</h2>
        <p className="mt-1 text-sm text-muted">Scan this code with your phone and log in. It opens this page there.</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <b>Gymix app, iPhone or Android:</b> writes each sticker with one tap, one machine after the other.
            </span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <b>Chrome on Android:</b> writes them straight from the website too.
            </span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <b>No NFC stickers?</b> Print the QR codes instead. Members scan them from their app.
            </span>
          </li>
        </ul>
        <p className="mt-4 truncate font-mono text-xs text-muted">{pageUrl}</p>
      </div>
      <div className="mx-auto w-[168px] rounded-2xl border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: pageQr }} />
    </div>
  );
}

function Row({
  machine: m,
  isDone,
  active,
  env,
  onWrite,
  onMark,
}: {
  machine: StickerMachine;
  isDone: boolean;
  active: boolean;
  env: Env;
  onWrite: () => void;
  onMark: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <li className={`flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors ${active ? "bg-brand/10" : ""}`}>
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas">
        {m.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumb} alt="" className="size-full object-cover" />
        ) : (
          <Dumbbell className="size-5 text-muted" />
        )}
      </span>
      <span className="min-w-[9rem] flex-1">
        <span className="block truncate font-medium">{m.name}</span>
        <Status isDone={isDone} tappedAt={m.tappedAt} />
      </span>
      <span className="flex flex-wrap gap-1.5">
        {env === "write" && (
          <button type="button" onClick={onWrite} className={buttonClass(isDone ? "ghost" : "secondary", "h-9 px-3")}>
            <Nfc className="size-4" /> {isDone ? "Rewrite" : "Write"}
          </button>
        )}
        {env !== "write" && (
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(m.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={buttonClass("secondary", "h-9 px-3")}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        {isDone ? (
          <button type="button" onClick={() => onMark(false)} className={buttonClass("ghost", "h-9 px-3 text-muted")} title="Put it back on the to-do list">
            <RotateCcw className="size-4" />
            <span className="sr-only">Undo</span>
          </button>
        ) : (
          env !== "write" && (
            <button type="button" onClick={() => onMark(true)} className={buttonClass("primary", "h-9 px-3")}>
              <Check className="size-4" /> Done
            </button>
          )
        )}
      </span>
    </li>
  );
}

function Status({ isDone, tappedAt }: { isDone: boolean; tappedAt: string | null }) {
  if (isDone && tappedAt)
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="size-3.5" /> Working · tapped {ago(tappedAt)}
      </span>
    );
  if (isDone)
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ink">
        <span className="size-1.5 rounded-full bg-brand ring-2 ring-brand/30" /> Sticker on · not tapped yet
      </span>
    );
  return <span className="mt-0.5 block text-xs text-muted">No sticker yet</span>;
}
