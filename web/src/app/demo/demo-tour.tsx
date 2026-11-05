"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Lock, MessageCircle, Nfc, Pause, Play, QrCode } from "lucide-react";

// A self-playing tour of Gymix: a phone shows each feature as a short animation,
// next to what it does and where an owner starts. Scenes are plain HTML so they stay crisp.

type Step = { title: string; who: string; what: string; start: string; scene: () => ReactNode };

// Each child fades up after the previous one (d = delay in tenths of a second).
const Row = ({ d = 0, className = "", children }: { d?: number; className?: string; children: ReactNode }) => (
  <div className={`demo-up ${className}`} style={{ animationDelay: `${d / 10}s` }}>
    {children}
  </div>
);
const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={`rounded-2xl bg-surface p-3 text-ink shadow-sm ${className}`}>{children}</div>
);

const STEPS: Step[] = [
  {
    title: "Create your membership plans",
    who: "Owner · 2 minutes",
    what: "Monthly, yearly or visit packs, priced in dollars. Gymix tracks every expiry for you.",
    start: "Dashboard → Plans → New plan. Set your lira rate in Settings → Gym.",
    scene: () => (
      <>
        <Row><p className="text-xs font-semibold text-muted">Plans</p></Row>
        {[["Monthly", "$45"], ["Yearly", "$420"], ["10 visits", "$30"]].map(([n, p], i) => (
          <Row key={n} d={3 + i * 4}>
            <Card className="flex items-center justify-between"><span className="font-semibold">{n}</span><span className="font-bold">{p}</span></Card>
          </Row>
        ))}
        <Row d={16}><Card className="text-xs text-muted">Lira rate: <b className="text-ink">89,500 LBP = $1</b></Card></Row>
      </>
    ),
  },
  {
    title: "Add a member, send the app on WhatsApp",
    who: "Front desk · 30 seconds",
    what: "Add a name and phone. The member gets a WhatsApp link: one tap and they're in their app. No store, no password.",
    start: "Dashboard → Members → Add member, then Sell membership.",
    scene: () => (
      <>
        <Row><Card><p className="text-xs text-muted">New member</p><p className="demo-type font-semibold">Nour Khalil · 70 123 456</p></Card></Row>
        <Row d={12}>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-xs text-ink">
            <MessageCircle className="mb-1 size-4 text-success" />
            Hi Nour, Iron House has set up your Gymix account. Open your portal: gymix.app/join/…
          </div>
        </Row>
        <Row d={22}><Card className="text-center text-sm font-semibold text-success">Nour opened the app ✓</Card></Row>
      </>
    ),
  },
  {
    title: "Members tap their phone to check in",
    who: "Owner · one-time setup",
    what: "A $1 NFC sticker at the door. Members tap and walk in. No NFC? They scan the QR code from their app.",
    start: "Settings → Check-in: write the link on a sticker from your phone and stick it at the entrance.",
    scene: () => (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="relative grid size-24 place-items-center rounded-3xl bg-ink text-brand">
          <Nfc className="size-10" />
          <span className="demo-ring absolute inset-0 rounded-3xl border-2 border-brand" />
        </div>
        <div className="demo-tap text-3xl">📱</div>
        <Row d={14} className="w-full"><div className="rounded-2xl bg-success p-4 text-center text-white"><p className="font-bold">Checked in</p><p className="text-xs opacity-80">Welcome back, Nour</p></div></Row>
      </div>
    ),
  },
  {
    title: "Unpaid? Frozen. Automatically.",
    who: "Runs by itself",
    what: "A member who still owes money a few days after an invoice is stopped at the door and sent to the front desk. Paying unfreezes them.",
    start: "Settings → Gym: choose after how many days (3 by default).",
    scene: () => (
      <div className="flex h-full flex-col justify-center gap-3">
        <Row><div className="demo-shake rounded-2xl bg-danger p-4 text-center text-white"><Lock className="mx-auto mb-1 size-6" /><p className="font-bold">Account frozen</p><p className="text-xs opacity-80">Please see the front desk</p></div></Row>
        <Row d={14}><Card className="flex justify-between text-sm"><span>Paid $45 in lira</span><Check className="size-4 text-success" /></Card></Row>
        <Row d={22}><div className="rounded-2xl bg-success p-4 text-center font-bold text-white">Checked in ✓</div></Row>
      </div>
    ),
  },
  {
    title: "Dollars and lira at your rate",
    who: "Front desk",
    what: "Invoices in USD. Take cash, card, Whish or OMT, or lira at your own rate. A receipt goes out on WhatsApp.",
    start: "Member page → Record payment. Who owes is on Dashboard → Billing.",
    scene: () => (
      <>
        <Row><Card><p className="text-xs text-muted">Invoice</p><p className="text-2xl font-bold">$45.00</p></Card></Row>
        <Row d={5} className="grid grid-cols-4 gap-1 text-center text-[11px] font-semibold">
          {["Cash", "LBP", "Whish", "OMT"].map((m) => <span key={m} className={`rounded-lg py-2 ${m === "LBP" ? "bg-brand" : "bg-surface"}`}>{m}</span>)}
        </Row>
        <Row d={10}><Card className="text-center"><p className="text-xs text-muted">Collect</p><p className="text-lg font-bold">4,027,500 LBP</p></Card></Row>
        <Row d={18}><div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-xs">Hi Nour, Iron House received your payment of $45. Thank you!</div></Row>
      </>
    ),
  },
  {
    title: "Programs from your trainers",
    who: "Trainer",
    what: "Members ask for a program in the app. Your trainer builds it with the machines you really have, and it lands on the member's home screen.",
    start: "Owner: Dashboard → Machines to list your equipment. Trainers: Programs → requests.",
    scene: () => (
      <>
        <Row><Card className="text-xs"><b>Nour</b> asked for a program: <i>“Build muscle, 4 days”</i></Card></Row>
        {["Leg Press · 4 × 10", "Lat Pulldown · 3 × 12", "Chest Press · 3 × 10"].map((e, i) => (
          <Row key={e} d={6 + i * 4}><Card className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-brand-strong" />{e}</Card></Row>
        ))}
        <Row d={20}><div className="rounded-2xl bg-ink p-3 text-center text-sm font-semibold text-brand">Sent to Nour&apos;s app</div></Row>
      </>
    ),
  },
  {
    title: "Workouts they come back for",
    who: "Member",
    what: "Today's workout, a rest timer, streaks and personal records with confetti. Shake the phone to open programs.",
    start: "Nothing to do: it's in every member's app.",
    scene: () => (
      <>
        <Row><div className="rounded-2xl bg-ink p-3 text-white"><p className="text-xs text-white/60">Today · Leg day</p><p className="font-bold">🔥 6-week streak</p></div></Row>
        {[["Set 1", "80 kg × 10"], ["Set 2", "85 kg × 8"]].map(([s, w], i) => (
          <Row key={s} d={5 + i * 5}><Card className="flex items-center justify-between text-sm"><span>{s} · {w}</span><span className="demo-pop grid size-6 place-items-center rounded-full bg-brand" style={{ animationDelay: `${0.8 + i * 0.5}s` }}><Check className="size-3.5" strokeWidth={3} /></span></Card></Row>
        ))}
        <Row d={18}><div className="relative rounded-2xl bg-brand p-3 text-center font-bold text-ink">New record! 85 kg 🎉
          {Array.from({ length: 10 }, (_, i) => <span key={i} className="demo-confetti absolute top-1/2 left-1/2 size-1.5 rounded-sm" style={{ background: i % 2 ? "#0d1117" : "#1f7a3f", ["--x" as string]: `${(i - 5) * 18}px`, animationDelay: "1.9s" }} />)}
        </div></Row>
      </>
    ),
  },
  {
    title: "Classes, bookings and waitlists",
    who: "Manager",
    what: "Day, week and month calendar. Members book in the app; a full class has a waitlist. Monthly courses like Pilates too.",
    start: "Dashboard → Schedule → quick add.",
    scene: () => (
      <>
        {[["18:00 Pilates", "8/10"], ["19:00 Boxing", "Full · waitlist 2"], ["20:00 Spinning", "5/12"]].map(([c, s], i) => (
          <Row key={c} d={i * 4}><Card className="flex items-center justify-between text-sm"><span className="font-semibold">{c}</span><span className="text-xs text-muted">{s}</span></Card></Row>
        ))}
        <Row d={14}><div className="demo-press rounded-2xl bg-ink p-3 text-center text-sm font-semibold text-white">Book Pilates</div></Row>
        <Row d={20}><Card className="text-center text-sm font-semibold text-success">Booked · 9/10 ✓</Card></Row>
      </>
    ),
  },
  {
    title: "Machines that teach",
    who: "Owner · stick once",
    what: "A sticker on each machine opens how to use it and the member's last weights on it.",
    start: "Dashboard → Machines → Print stickers (QR) or write NFC.",
    scene: () => (
      <>
        <Row className="flex justify-center"><div className="grid size-20 place-items-center rounded-2xl bg-ink text-brand"><QrCode className="size-10" /></div></Row>
        <Row d={8}><div className="demo-sheet rounded-t-3xl bg-surface p-4 text-ink shadow-lg"><p className="font-bold">Leg Press</p><p className="mt-1 text-xs text-muted">Feet shoulder-width, push through your heels, don&apos;t lock your knees.</p><p className="mt-3 rounded-xl bg-canvas p-2 text-sm">Last time: <b>80 kg × 10</b></p></div></Row>
      </>
    ),
  },
  {
    title: "Members pause themselves",
    who: "Member",
    what: "Travelling or injured? Members pause from the app and the days are added to the end date. No calls to the front desk.",
    start: "Nothing to do: it's on the member's Home.",
    scene: () => (
      <div className="flex h-full flex-col justify-center gap-3">
        <Row><Card><p className="text-xs text-muted">Membership ends</p><p className="text-lg font-bold">12 Dec → <span className="text-success">26 Dec</span></p></Card></Row>
        <Row d={6}><div className="demo-press flex items-center justify-center gap-2 rounded-2xl bg-ink p-3 font-semibold text-white"><Pause className="size-4" /> Paused 14 days</div></Row>
        <Row d={12}><Card className="text-center text-xs text-muted">Resume any time from Home</Card></Row>
      </div>
    ),
  },
];

const SCENE_MS = 6000;

export function DemoTour() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((n) => (n + 1) % STEPS.length), SCENE_MS);
    return () => clearTimeout(t);
  }, [i, playing]);
  const step = STEPS[i];

  return (
    <section className="px-4 py-12">
      <style>{CSS}</style>
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_340px]">
        {/* Phone first on small screens */}
        <div className="lg:order-2 lg:sticky lg:top-24">
          <div className="mx-auto w-[300px] rounded-[2.5rem] border-[8px] border-[#2a2f36] bg-canvas p-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[#2a2f36]" />
            <div key={i} className="flex h-[420px] flex-col gap-2 overflow-hidden">{step.scene()}</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
              <div key={`p${i}${playing}`} className={playing ? "demo-bar h-full bg-brand-strong" : "h-full w-0"} />
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? "Pause" : "Play"}
            </button>
          </div>
        </div>

        <ol className="space-y-2 lg:order-1">
          {STEPS.map((s, n) => (
            <li key={s.title}>
              <button
                onClick={() => { setI(n); setPlaying(false); }}
                className={`w-full rounded-2xl border p-4 text-left transition ${n === i ? "border-brand-strong bg-surface shadow-md" : "border-line bg-surface/60 hover:bg-surface"}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${n === i ? "bg-brand text-ink" : "bg-canvas text-muted"}`}>{n + 1}</span>
                  <span className="font-semibold">{s.title}</span>
                </span>
                {n === i && (
                  <span className="demo-up mt-3 block space-y-2 pl-10 text-sm">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-brand-strong">{s.who}</span>
                    <span className="block text-muted">{s.what}</span>
                    <span className="block rounded-xl bg-canvas p-3"><b>How to start:</b> {s.start}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const CSS = `
.demo-up{animation:demo-up .5s both cubic-bezier(.2,.8,.2,1)}
@keyframes demo-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.demo-type{overflow:hidden;white-space:nowrap;animation:demo-type 1s .2s steps(24) both}
@keyframes demo-type{from{max-width:0}to{max-width:100%}}
.demo-ring{animation:demo-ring 1.2s 1s ease-out 2}
@keyframes demo-ring{from{transform:scale(1);opacity:1}to{transform:scale(1.5);opacity:0}}
.demo-tap{animation:demo-tap 1.2s .2s both}
@keyframes demo-tap{0%{transform:translateY(40px);opacity:0}60%{transform:translateY(-14px);opacity:1}100%{transform:translateY(-6px)}}
.demo-shake{animation:demo-up .4s both,demo-shake .5s .5s 2}
@keyframes demo-shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.demo-pop{animation:demo-pop .4s both cubic-bezier(.3,1.6,.5,1)}
@keyframes demo-pop{from{transform:scale(0)}to{transform:scale(1)}}
.demo-press{animation:demo-press .3s 1.6s 1}
@keyframes demo-press{50%{transform:scale(.94)}}
.demo-sheet{animation:demo-sheet .6s 1s both cubic-bezier(.2,.8,.2,1)}
@keyframes demo-sheet{from{transform:translateY(100%)}to{transform:none}}
.demo-confetti{animation:demo-confetti .9s both ease-out}
@keyframes demo-confetti{from{transform:translate(0,0);opacity:1}to{transform:translate(var(--x),-46px) rotate(200deg);opacity:0}}
.demo-bar{animation:demo-bar ${SCENE_MS}ms linear both}
@keyframes demo-bar{from{width:0}to{width:100%}}
@media (prefers-reduced-motion:reduce){[class*="demo-"]{animation:none!important}}
`;
