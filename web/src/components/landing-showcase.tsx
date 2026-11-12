import { BellRing, CloudOff, Map, Nfc, QrCode, ScanBarcode, ShieldCheck, Smartphone, Timer, Trophy, Users, Megaphone, Moon, UserRoundX, LayoutGrid } from "lucide-react";
import { ChallengeCardFace } from "@/components/challenge-card";
import { Reveal } from "@/components/landing-interactive";
import { LogoMark } from "@/components/logo-mark";
import { RankMedal } from "@/components/rank-medal";

// The landing page's newer chapters, drawn from the real app's pieces (the
// challenge card, the door waves, the desk answer) so they're always current
// and always crisp. Pure CSS motion; nothing to load.

const Kicker = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <p className={`text-xs font-semibold tracking-[0.32em] uppercase ${dark ? "text-brand" : "text-ink/45"}`}>{children}</p>
);

function Bullets({ items, dark = false }: { items: string[]; dark?: boolean }) {
  return (
    <ul className={`mt-8 space-y-3 text-[15px] ${dark ? "text-white/80" : "text-ink/70"}`}>
      {items.map((x) => (
        <li key={x} className="flex gap-3">
          <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${dark ? "bg-brand" : "bg-ink"}`} />
          {x}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ doors
export function DoorShowcase() {
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-28 text-white sm:py-40">
      <span aria-hidden className="challenge-grid opacity-60" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <Kicker dark>Doors</Kicker>
          <h2 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Tap. Open. <span className="text-brand">Train.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
            Members hold their phone to the sticker at the door and walk in. Unpaid members don&apos;t. Your staff open any door from anywhere with a slide.
          </p>
          <Bullets
            dark
            items={["Under 3 seconds from tap to open door", "The phone has to be at the gym: no opening from home", "An exit sticker, so the live count knows who left", "Works with ZKTeco and Hikvision readers you already have"]}
          />
        </Reveal>
        <Reveal delay={150} className="relative mx-auto w-full max-w-[19rem]">
          <div className="lx-phone relative aspect-[9/19] rounded-[3rem] bg-[#05070a] p-3 shadow-[0_60px_120px_-40px_rgb(200_241_53/0.35)] ring-1 ring-white/15">
            <div className="relative h-full overflow-hidden rounded-[2.4rem] bg-gradient-to-b from-[#121821] to-[#07090d]">
              <span aria-hidden className="absolute top-2.5 left-1/2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
              <span aria-hidden className="door-waves">
                <i />
                <i />
                <i />
                <i />
              </span>
              <div className="lx-door-result absolute inset-x-5 bottom-10 rounded-3xl bg-white/[0.08] p-5 text-center ring-1 ring-white/10 backdrop-blur-xl">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-ink">
                  <LogoMark className="size-9" />
                </span>
                <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-brand uppercase">Door open</p>
                <p className="mt-1 text-xl font-black">Welcome, Nour</p>
                <p className="mt-1 text-xs text-white/50">Monthly · 12 days left</p>
              </div>
            </div>
          </div>
          {/* Staff: slide to open, from anywhere. */}
          <div aria-hidden className="absolute -bottom-6 -left-4 w-60 rounded-2xl bg-white p-3 text-ink shadow-2xl sm:-left-16">
            <p className="text-[10px] font-bold tracking-[0.18em] text-ink/40 uppercase">Main entrance</p>
            <div className="relative mt-2 h-11 overflow-hidden rounded-full bg-canvas">
              <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-ink/40">Slide to open</span>
              <span className="lx-slide absolute top-1 left-1 grid size-9 place-items-center rounded-full bg-ink text-brand">
                <Nfc className="size-4" />
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- challenges
export function ChallengeShowcase() {
  const card = {
    title: "November visits challenge",
    metric: "visits",
    description: null,
    prize: "Free month",
    target: 12,
    starts_on: "2026-11-01",
    ends_on: "2026-11-30",
    state: "active" as const,
    days_left: 17,
    participants: 64,
  };
  const board = [
    { rank: 1, name: "Nour K.", score: "14 days" },
    { rank: 2, name: "Rami H.", score: "12 days" },
    { rank: 3, name: "Lara N.", score: "11 days" },
  ];
  return (
    <section className="px-5 py-28 sm:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal className="relative mx-auto h-[30rem] w-full max-w-sm lg:order-2">
          <div aria-hidden className="absolute inset-0 translate-x-6 translate-y-5 rotate-6 scale-95 opacity-60">
            <ChallengeCardFace challenge={{ ...card, title: "Lift the most", metric: "volume", prize: null, target: null }} preview />
          </div>
          <div className="lx-swipe absolute inset-0">
            <ChallengeCardFace challenge={card} preview />
            <span className="lx-join pointer-events-none absolute top-8 left-6 rounded-xl border-4 border-brand px-3 py-1 text-2xl font-black tracking-widest text-brand">JOIN</span>
          </div>
        </Reveal>
        <Reveal delay={150} className="lg:order-1">
          <Kicker>Challenges</Kicker>
          <h2 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
            Give them a reason <em className="text-ink/45 not-italic">to come back.</em>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/60">
            Post a monthly challenge in a minute. Members swipe to join, Gymix counts every visit and set, and the leaderboard does the rest.
          </p>
          <ol className="mt-8 max-w-sm space-y-2">
            {board.map((r) => (
              <li key={r.rank} className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3">
                <RankMedal rank={r.rank} />
                <span className="flex-1 font-medium">{r.name}</span>
                <span className="text-sm font-semibold tabular-nums text-ink/60">{r.score}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- notifications
export function NotifyShowcase() {
  const items = [
    { icon: Trophy, title: "New challenge: November visits", body: "Most days at the gym wins a free month. Swipe to join." },
    { icon: UserRoundX, title: "We miss you, Rami", body: "It's been 11 days. Your spot is waiting. Even 20 minutes counts." },
    { icon: BellRing, title: "You got a spot", body: "Spinning, Thursday 7 pm. Someone cancelled, you're in." },
    { icon: Moon, title: "Today at Iron Temple", body: "84 check-ins · $420 taken · 3 ending tomorrow" },
  ];
  return (
    <section className="relative overflow-hidden bg-canvas px-5 py-28 sm:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <Kicker>Notifications</Kicker>
          <h2 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
            On their lock screen, <em className="text-ink/45 not-italic">not lost in WhatsApp.</em>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/60">Real push notifications on iPhone and Android, even when the app is closed.</p>
          <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
            {[
              { icon: Megaphone, t: "Announcements", d: "Everyone, or only who's ending this week" },
              { icon: UserRoundX, t: "Win-back", d: "A nudge when someone stops coming" },
              { icon: Moon, t: "Nightly summary", d: "Your day in one line, every evening" },
              { icon: Timer, t: "Rest timer", d: "Buzzes on the lock screen between sets" },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl bg-surface p-4 ring-1 ring-ink/[0.06]">
                <f.icon className="size-5" />
                <p className="mt-2 font-semibold">{f.t}</p>
                <p className="text-sm text-ink/55">{f.d}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={150} className="relative mx-auto w-full max-w-sm">
          <div className="relative overflow-hidden rounded-[2.6rem] bg-gradient-to-b from-[#1a2410] via-[#0f141b] to-[#0b0f15] px-4 pt-14 pb-8 shadow-2xl">
            <p className="text-center text-6xl font-semibold tracking-tight text-white/90 tabular-nums">7:42</p>
            <p className="mb-6 text-center text-sm text-white/50">Thursday 13 November</p>
            <ul className="space-y-2">
              {items.map((n, i) => (
                <li key={n.title} className="lx-note flex items-start gap-2.5 rounded-2xl bg-white/[0.11] p-3 backdrop-blur-xl" style={{ animationDelay: `${i * 0.9}s` }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-ink">
                    <n.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between text-[11px] text-white/50">
                      <span className="font-semibold tracking-wide text-white/70 uppercase">Gymix</span>
                      {i === 0 ? "now" : `${i * 7}m ago`}
                    </span>
                    <span className="block truncate text-[13px] font-semibold text-white">{n.title}</span>
                    <span className="block text-[12px] leading-snug text-white/70">{n.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- front desk
export function DeskShowcase() {
  return (
    <section className="desk bg-ink relative overflow-hidden px-5 py-28 text-white sm:py-40">
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal className="relative mx-auto w-full max-w-md lg:order-2">
          <div className="rounded-[2rem] bg-white/[0.04] p-7 ring-1 ring-white/10">
            <div className="flex flex-col items-center text-center">
              <span className="lx-ring grid size-28 place-items-center rounded-full bg-brand/15">
                <span className="grid size-20 place-items-center rounded-full bg-brand text-3xl font-black text-ink">NK</span>
              </span>
              <p className="mt-5 text-xs font-bold tracking-[0.22em] text-brand uppercase">Welcome</p>
              <p className="mt-1 text-3xl font-black tracking-tight">Nour Khalil</p>
              <div className="mt-5 flex gap-2">
                <span className="rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/10">
                  <span className="block text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">Plan</span>
                  <span className="font-semibold">Monthly</span>
                </span>
                <span className="rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/10">
                  <span className="block text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">Until</span>
                  <span className="font-semibold">12 Dec</span>
                </span>
              </div>
            </div>
            <span className="lx-timer mt-6 block h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-brand" />
            </span>
          </div>
        </Reveal>
        <Reveal delay={150} className="lg:order-1">
          <Kicker dark>Front desk</Kicker>
          <h2 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Your reception, <span className="text-brand">on autopilot.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
            Put a tablet on the counter. Members show their code; Gymix says yes in green, or no in red with the reason, before your staff look up.
          </p>
          <Bullets dark items={["The tablet's camera or any USB barcode reader", "Who owes money, flagged on the spot", "Live: who's inside now, check-ins today", "The Shop scans product barcodes the same way"]} />
        </Reveal>
      </div>
    </section>
  );
}

// ----------------------------------------------------------- everything else
export function Bento() {
  const tiles = [
    { icon: CloudOff, t: "Works offline", d: "Log a workout in a basement gym. It syncs when the signal is back.", cls: "lx-b-pulse" },
    { icon: QrCode, t: "Share a program", d: "QR code or AirDrop. Friends from your gym get a copy.", cls: "lx-b-qr" },
    { icon: Nfc, t: "Machine stickers", d: "Tap a machine: how to use it, and your last weights on it.", cls: "lx-b-ring" },
    { icon: Users, t: "Live count", d: "How busy the gym is now, for members deciding when to come.", cls: "lx-b-count" },
    { icon: Map, t: "On the map", d: "Your gym's location, with phone-must-be-here door taps.", cls: "lx-b-pin" },
    { icon: LayoutGrid, t: "Home-screen widget", d: "Days left, today's workout and how busy it is, at a glance.", cls: "lx-b-pulse" },
    { icon: ScanBarcode, t: "Shop", d: "Supplements, drinks and merch, scanned and on the member's account.", cls: "lx-b-scan" },
    { icon: Smartphone, t: "iPhone, Android, web", d: "One Gymix everywhere: the browser today, the stores next.", cls: "lx-b-ring" },
    { icon: ShieldCheck, t: "Private by design", d: "Each gym's data walled off. Members download or delete theirs anytime.", cls: "lx-b-pulse" },
  ];
  return (
    <section className="px-5 py-28 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <Kicker>And everything else</Kicker>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
            The small things <em className="text-ink/45 not-italic">members love.</em>
          </h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((x, i) => (
            <Reveal key={x.t} delay={(i % 3) * 100}>
              <div className="group h-full rounded-3xl bg-surface p-6 ring-1 ring-ink/[0.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgb(13_17_23/0.3)]">
                <span className={`lx-b relative grid size-12 place-items-center rounded-2xl bg-ink text-brand ${x.cls}`}>
                  <x.icon className="relative size-6" />
                </span>
                <p className="mt-5 text-lg font-bold tracking-tight">{x.t}</p>
                <p className="mt-1.5 leading-relaxed text-ink/55">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
