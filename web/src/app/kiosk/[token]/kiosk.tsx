"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Delete, Loader2, QrCode, ScanLine, Smartphone, UserPlus, Wallet, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

// Self-service reception: check in, join, buy or renew. Everything goes
// through /api/kiosk/<token>. Returns to the start screen when left alone.

type Plan = { id: string; name: string; description: string | null; price: number; period: string; count: number; visits: number | null };
type Info = { kiosk: { name: string; checkin: boolean; join: boolean; buy: boolean }; gym: { name: string; lbp_rate: number }; pay: { whish: string | null; omt: string | null; card_terminal: boolean }; plans: Plan[] };
type Member = { id: string; first_name: string; status: string; plan: string | null; ends_on: string | null };
type Intent = { id: string; reference: string; amount: number; amount_lbp: number; channel: string };
type Screen =
  | { name: "home" }
  | { name: "identify"; next: "checkin" | "buy" }
  | { name: "checkin"; result: { allowed: boolean; already_in: boolean; reason: string | null; first_name: string; plan: string | null; ends_on: string | null; visits_left: number | null } }
  | { name: "join" }
  | { name: "plans"; member: Member }
  | { name: "pay"; member: Member; plan: Plan }
  | { name: "waiting"; member: Member; plan: Plan; intent: Intent }
  | { name: "paid"; member: Member; plan: Plan; ends_on: string | null };

const usd = (n: number) => `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
const lbp = (n: number) => `LBP ${new Intl.NumberFormat("en-US").format(n)}`;
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const length = (p: Plan) => {
  const unit = { day: "day", week: "week", month: "month", year: "year" }[p.period] ?? p.period;
  return `${p.count} ${unit}${p.count === 1 ? "" : "s"}${p.visits ? ` · ${p.visits} visits` : ""}`;
};

export function Kiosk({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);

  const api = useCallback(
    // undefined: the request failed (the error is shown); null: nothing found.
    async <T,>(body: Record<string, unknown>): Promise<T | null | undefined> => {
      setError(null);
      try {
        const res = await fetch(`/api/kiosk/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 404) setFatal(json.error ?? "This kiosk isn't available.");
          else setError(json.error ?? "Something went wrong.");
          return undefined;
        }
        return json.data as T;
      } catch {
        setError("No connection. Please ask at the front desk.");
        return undefined;
      }
    },
    [token],
  );

  useEffect(() => {
    const load = () => api<Info>({ action: "info" }).then((d) => d && setInfo(d));
    const first = setTimeout(load, 0);
    const id = setInterval(load, 10 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [api]);

  // Back to the start when nobody touches it (longer while waiting to pay).
  const home = useCallback(() => {
    setScreen({ name: "home" });
    setError(null);
  }, []);
  useEffect(() => {
    const touch = () => (last.current = Date.now());
    touch();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const id = setInterval(() => {
      const limit = screen.name === "waiting" ? 5 * 60_000 : screen.name === "paid" ? 15_000 : screen.name === "checkin" ? 8_000 : 60_000;
      if (screen.name !== "home" && Date.now() - last.current > limit) home();
    }, 1000);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [screen.name, home]);

  // Waiting for the payment to be confirmed.
  useEffect(() => {
    if (screen.name !== "waiting") return;
    const id = setInterval(async () => {
      const s = await api<{ status: string; ends_on: string | null }>({ action: "status", intentId: screen.intent.id });
      if (s?.status === "paid") setScreen({ name: "paid", member: screen.member, plan: screen.plan, ends_on: s.ends_on });
      if (s && (s.status === "cancelled" || s.status === "expired")) {
        setError("This payment request was cancelled. Please ask at the front desk.");
        home();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [screen, api, home]);

  if (fatal) {
    return (
      <Shell gym={null}>
        <Centered>
          <XCircle className="mx-auto size-16 text-white/60" />
          <p className="mt-4 text-3xl font-semibold">Reception isn&apos;t available here</p>
          <p className="mt-2 text-lg text-white/60">{fatal}</p>
        </Centered>
      </Shell>
    );
  }
  if (!info) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-ink">
        <Loader2 className="size-12 animate-spin text-brand" />
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell gym={info.gym.name} onBack={screen.name !== "home" && screen.name !== "checkin" && screen.name !== "paid" ? home : undefined}>
      {error && <p className="mx-auto mb-6 max-w-2xl rounded-2xl bg-danger/90 px-5 py-4 text-center text-lg font-medium">{error}</p>}

      {screen.name === "home" && (
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center">
          <h1 className="text-center text-5xl font-bold tracking-tight">Welcome to {info.gym.name}</h1>
          <p className="mt-3 text-center text-xl text-white/60">What would you like to do?</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {info.kiosk.checkin && <BigButton icon={ScanLine} title="Check in" sub="With your phone number or member code" onClick={() => setScreen({ name: "identify", next: "checkin" })} primary />}
            {info.kiosk.buy && info.plans.length > 0 && <BigButton icon={Wallet} title="Buy or renew" sub="A membership, in a minute" onClick={() => setScreen({ name: "identify", next: "buy" })} />}
            {info.kiosk.join && <BigButton icon={UserPlus} title="I'm new here" sub="Join the gym" onClick={() => setScreen({ name: "join" })} />}
          </div>
        </div>
      )}

      {screen.name === "identify" && (
        <Identify
          title={screen.next === "checkin" ? "Check in" : "Buy or renew"}
          busy={busy}
          onSubmit={(query) =>
            run(async () => {
              const member = await api<Member | null>({ action: "find", query });
              if (member === undefined) return;
              if (member === null) {
                setError("We couldn't find you. Check the number, or ask at the front desk.");
                return;
              }
              if (screen.next === "checkin") {
                const result = await api<Extract<Screen, { name: "checkin" }>["result"]>({ action: "checkin", memberId: member.id });
                if (result) setScreen({ name: "checkin", result });
              } else setScreen({ name: "plans", member });
            })
          }
          onNew={info.kiosk.join ? () => setScreen({ name: "join" }) : undefined}
        />
      )}

      {screen.name === "checkin" && <CheckinResult result={screen.result} />}

      {screen.name === "join" && (
        <Join
          busy={busy}
          onSubmit={(fullName, phone, email) =>
            run(async () => {
              const m = await api<{ id: string; first_name: string }>({ action: "join", fullName, phone, email });
              if (!m) return;
              const member: Member = { id: m.id, first_name: m.first_name, status: "none", plan: null, ends_on: null };
              if (info.kiosk.buy && info.plans.length) setScreen({ name: "plans", member });
              else setScreen({ name: "checkin", result: { allowed: true, already_in: false, reason: null, first_name: m.first_name, plan: null, ends_on: null, visits_left: null } });
            })
          }
        />
      )}

      {screen.name === "plans" && (
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight">Hi {screen.member.first_name}</h1>
          <p className="mt-2 text-xl text-white/60">
            {screen.member.status === "active" && screen.member.ends_on
              ? `Your ${screen.member.plan ?? "membership"} runs until ${day(screen.member.ends_on)}. A renewal starts the day after.`
              : "Choose your membership."}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {info.plans.map((p) => (
              <button key={p.id} type="button" onClick={() => setScreen({ name: "pay", member: screen.member, plan: p })} className="rounded-3xl bg-white/[0.06] p-6 text-left ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.98]">
                <p className="text-2xl font-semibold">{p.name}</p>
                <p className="mt-1 text-white/60">{length(p)}</p>
                {p.description && <p className="mt-2 text-sm text-white/50">{p.description}</p>}
                <p className="mt-6 text-4xl font-bold text-brand">{usd(p.price)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {screen.name === "pay" && (
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight">
            {screen.plan.name} · {usd(screen.plan.price)}
          </h1>
          <p className="mt-2 text-xl text-white/60">How would you like to pay?</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { channel: "desk", icon: Banknote, title: "At the front desk", sub: "Cash in dollars or lira", show: true },
              { channel: "card_terminal", icon: CreditCard, title: "Card", sub: "On the card machine at the desk", show: info.pay.card_terminal },
              { channel: "whish", icon: Smartphone, title: "Whish Money", sub: `To ${info.pay.whish}`, show: Boolean(info.pay.whish) },
              { channel: "omt", icon: Wallet, title: "OMT", sub: `To ${info.pay.omt}`, show: Boolean(info.pay.omt) },
            ]
              .filter((c) => c.show)
              .map((c) => (
                <BigButton
                  key={c.channel}
                  icon={c.icon}
                  title={c.title}
                  sub={c.sub}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      if (screen.name !== "pay") return;
                      const intent = await api<Intent>({ action: "buy", memberId: screen.member.id, planId: screen.plan.id, channel: c.channel });
                      if (intent) setScreen({ name: "waiting", member: screen.member, plan: screen.plan, intent });
                    })
                  }
                />
              ))}
          </div>
        </div>
      )}

      {screen.name === "waiting" && <Waiting intent={screen.intent} pay={info.pay} />}

      {screen.name === "paid" && (
        <ResultScreen tone="good">
          <CheckCircle2 className="mx-auto size-24" />
          <p className="mt-4 text-sm font-semibold tracking-widest uppercase opacity-80">Payment received</p>
          <p className="mt-2 text-5xl font-bold">You&apos;re all set, {screen.member.first_name}</p>
          <p className="mt-4 text-2xl opacity-90">
            {screen.plan.name}
            {screen.ends_on ? ` · until ${day(screen.ends_on)}` : ""}
          </p>
        </ResultScreen>
      )}
    </Shell>
  );
}

function Shell({ gym, onBack, children }: { gym: string | null; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto bg-ink text-white select-none">
      <header className="flex items-center justify-between px-8 pt-6">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex h-14 items-center gap-2 rounded-2xl bg-white/10 px-5 text-lg font-medium active:scale-95">
            <ArrowLeft className="size-5" /> Start again
          </button>
        ) : (
          <span className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand p-2 text-ink">
              <LogoMark className="size-full" />
            </span>
            {gym && <span className="text-2xl font-semibold">{gym}</span>}
          </span>
        )}
        <span className="text-sm text-white/40">Self-service reception</span>
      </header>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => <div className="grid h-full place-items-center text-center"><div>{children}</div></div>;

function BigButton({ icon: Icon, title, sub, onClick, primary = false, disabled = false }: { icon: typeof ScanLine; title: string; sub: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-48 flex-col justify-between rounded-[2rem] p-7 text-left transition active:scale-[0.97] disabled:opacity-50 ${primary ? "bg-brand text-ink" : "bg-white/[0.07] ring-1 ring-white/10 hover:bg-white/10"}`}
    >
      <Icon className="size-10" />
      <span>
        <span className="block text-3xl font-bold">{title}</span>
        <span className={`mt-1 block text-lg ${primary ? "text-ink/70" : "text-white/60"}`}>{sub}</span>
      </span>
    </button>
  );
}

// Phone number or member code, typed on a big keypad (or the tablet keyboard), or the member's QR.
function Identify({ title, busy, onSubmit, onNew }: { title: string; busy: boolean; onSubmit: (q: string) => void; onNew?: () => void }) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const press = (k: string) => setValue((v) => (k === "del" ? v.slice(0, -1) : (v + k).slice(0, 20)));
  const ok = value.replace(/\D/g, "").length >= 7 || /^[0-9A-Fa-f]{10}$/.test(value);
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-xl text-white/60">Your phone number, or your member code (Gymix app → Profile).</p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 20))}
          onKeyDown={(e) => e.key === "Enter" && ok && !busy && onSubmit(value)}
          inputMode="tel"
          aria-label="Phone number or member code"
          placeholder="70 123 456"
          className="mt-8 h-20 w-full rounded-2xl bg-white/10 px-6 text-center text-4xl font-semibold tracking-wider text-white outline-none placeholder:text-white/25 focus:ring-4 focus:ring-brand/60"
        />
        <button
          type="button"
          disabled={!ok || busy}
          onClick={() => onSubmit(value)}
          className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-2xl font-bold text-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy && <Loader2 className="size-6 animate-spin" />} Continue
        </button>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => setScanning(true)} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-lg font-medium active:scale-[0.98]">
            <QrCode className="size-5" /> Scan my QR
          </button>
          {onNew && (
            <button type="button" onClick={onNew} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-lg font-medium active:scale-[0.98]">
              <UserPlus className="size-5" /> I&apos;m new
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "del"].map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className="h-20 rounded-2xl bg-white/[0.07] text-3xl font-semibold ring-1 ring-white/10 active:scale-95 active:bg-white/15" aria-label={k === "del" ? "Delete" : k}>
            {k === "del" ? <Delete className="mx-auto size-7" /> : k}
          </button>
        ))}
      </div>
      {scanning && (
        <QrScan
          onCode={(code) => {
            setScanning(false);
            // The member app's QR holds their member code, alone or in a link.
            const found = code.match(/[0-9A-Fa-f]{10}/)?.[0];
            if (found) onSubmit(found);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function QrScan({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor) {
      queueMicrotask(() => setProblem("This tablet can't scan codes. Type your phone number instead."));
      return;
    }
    const detector = new Ctor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) onCode(found[0].rawValue);
          else timer = window.setTimeout(tick, 250);
        };
        tick();
      })
      .catch(() => setProblem("The camera isn't available. Type your phone number instead."));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-8" onClick={onClose}>
      <div className="w-full max-w-xl text-center" onClick={(e) => e.stopPropagation()}>
        {problem ? (
          <p className="rounded-2xl bg-white/10 p-6 text-xl">{problem}</p>
        ) : (
          <div className="relative overflow-hidden rounded-3xl">
            <video ref={video} playsInline muted className="aspect-square w-full -scale-x-100 object-cover" />
            <span className="scan-line pointer-events-none absolute inset-x-10 h-1 rounded-full bg-brand" />
          </div>
        )}
        <p className="mt-4 text-lg text-white/70">Hold the QR from your Gymix app up to the camera.</p>
        <button type="button" onClick={onClose} className="mt-4 h-14 rounded-2xl bg-white/10 px-8 text-lg font-medium">
          Close
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-40 grid place-items-center overflow-hidden text-center text-white ${tone === "good" ? "bg-success" : "bg-danger"}`}>
      <span className="tap-waves" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <div className="relative px-8">{children}</div>
    </div>
  );
}

function CheckinResult({ result }: { result: Extract<Screen, { name: "checkin" }>["result"] }) {
  if (!result.allowed) {
    return (
      <ResultScreen tone="bad">
        <XCircle className="mx-auto size-24" />
        <p className="mt-4 text-5xl font-bold">Not checked in</p>
        <p className="mt-2 text-2xl font-medium">{result.first_name}</p>
        <p className="mt-4 text-xl opacity-90">{result.reason}. Please see the front desk.</p>
      </ResultScreen>
    );
  }
  return (
    <ResultScreen tone="good">
      <CheckCircle2 className="mx-auto size-24" />
      <p className="mt-4 text-sm font-semibold tracking-widest uppercase opacity-80">{result.already_in ? "Already checked in" : "Checked in"}</p>
      <p className="mt-2 text-6xl font-bold">Welcome, {result.first_name}</p>
      {(result.plan || result.visits_left !== null) && (
        <p className="mt-4 text-2xl opacity-90">
          {[result.plan, result.ends_on && `until ${day(result.ends_on)}`, result.visits_left !== null && `${result.visits_left} visits left`].filter(Boolean).join(" · ")}
        </p>
      )}
    </ResultScreen>
  );
}

function Join({ busy, onSubmit }: { busy: boolean; onSubmit: (name: string, phone: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const field = "h-16 w-full rounded-2xl bg-white/10 px-5 text-2xl text-white outline-none placeholder:text-white/25 focus:ring-4 focus:ring-brand/60";
  const ready = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 7 && agree;
  return (
    <form
      className="mx-auto max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onSubmit(name, phone, email);
      }}
    >
      <h1 className="text-4xl font-bold tracking-tight">Welcome! Let&apos;s get you started</h1>
      <label className="block">
        <span className="mb-2 block text-lg text-white/70">Full name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Lea Haddad" className={field} />
      </label>
      <label className="block">
        <span className="mb-2 block text-lg text-white/70">Phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="70 123 456" className={field} />
      </label>
      <label className="block">
        <span className="mb-2 block text-lg text-white/70">Email (optional)</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" className={field} />
      </label>
      <label className="flex items-start gap-3 text-lg text-white/70">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-6 accent-[#c8f135]" />
        The gym may keep my details to manage my membership and contact me on WhatsApp.
      </label>
      <button type="submit" disabled={!ready || busy} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-2xl font-bold text-ink transition active:scale-[0.98] disabled:opacity-40">
        {busy && <Loader2 className="size-6 animate-spin" />} Join
      </button>
    </form>
  );
}

function Waiting({ intent, pay }: { intent: Intent; pay: Info["pay"] }) {
  const how: Record<string, string> = {
    desk: "Pay at the front desk and give them this code.",
    card_terminal: "Pay by card at the front desk and give them this code.",
    whish: `Send ${usd(intent.amount)} by Whish Money to ${pay.whish}, with this code as the note. Then show the receipt at the desk.`,
    omt: `Send ${usd(intent.amount)} by OMT to ${pay.omt}, with this code. Then show the receipt at the desk.`,
    online: "Complete the payment on your phone.",
  };
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xl text-white/60">Your code</p>
      <p className="mt-2 font-mono text-8xl font-bold tracking-wider text-brand">{intent.reference}</p>
      <p className="mt-6 text-4xl font-bold">{usd(intent.amount)}</p>
      <p className="mt-1 text-xl text-white/60">or {lbp(intent.amount_lbp)} in cash</p>
      <p className="mx-auto mt-8 max-w-xl text-2xl leading-snug">{how[intent.channel]}</p>
      <p className="mt-10 flex items-center justify-center gap-3 text-lg text-white/60">
        <Loader2 className="size-5 animate-spin" /> Your membership starts as soon as the payment is confirmed.
      </p>
    </div>
  );
}
