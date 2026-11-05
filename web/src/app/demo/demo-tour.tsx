"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Apple,
  BatteryFull,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Dumbbell,
  Flame,
  Grid2x2,
  House,
  LayoutDashboard,
  Loader2,
  Lock,
  Menu,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  Receipt,
  ScanLine,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Signal,
  Smartphone,
  Tags,
  Trash2,
  Trophy,
  TrendingUp,
  UserRound,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ExerciseAnimation } from "@/components/exercise-media";
import { LogoMark } from "@/components/logo-mark";
import { Badge, Card, Logo, PageHeader, SectionTitle, buttonClass, inputClass } from "@/components/ui";
import { PLAN_FEATURES } from "@/lib/pricing";

// The full Gymix tour. Every feature plays as a scene built from the app's own
// pieces (cards, badges, buttons, fields, the dashboard sidebar, the member
// app's tab bar) on a laptop or a phone. One clock drives everything: a scene
// is a function of the time since it started, so it can be paused, and a
// cursor (laptop) or a finger (phone) moves to real elements marked
// data-tap="…" and clicks them with a ripple.

// ---------------------------------------------------------------- timing
const clamp = (p: number) => Math.min(1, Math.max(0, p));
const ease = (p: number) => 1 - (1 - clamp(p)) ** 3;
// Text typed from `at`, `cps` characters a second.
const typed = (s: string, t: number, at: number, cps = 14) => s.slice(0, Math.max(0, Math.floor(((t - at) * cps) / 1000)));
// A number counting up from 0 to `to`, starting at `at`.
const count = (to: number, t: number, at: number, dur = 900) => Math.round(to * ease((t - at) / dur));
const num = (x: number) => x.toLocaleString("en-US");

type Tap = { at: number; id: string };

// Shown from `at` (and gone at `until`), rising in like the app's cards.
function At({ t, at, until, className = "", anim = "d-rise", children }: { t: number; at: number; until?: number; className?: string; anim?: string; children: ReactNode }) {
  if (t < at || (until !== undefined && t >= until)) return null;
  return <div className={`${anim} ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------- app pieces
function Input({ id, label, value, placeholder, focus, hint, right, secret }: { id?: string; label: string; value?: string; placeholder?: string; focus?: boolean; hint?: string; right?: ReactNode; secret?: boolean }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <div data-tap={id} className={`${inputClass} flex items-center ${focus ? "border-ink ring-4 ring-brand/40" : ""}`}>
        <span className={`truncate ${value ? "" : "text-muted/70"}`}>{value ? (secret ? "•".repeat(value.length) : value) : placeholder}</span>
        {focus && <span className="d-caret ml-px h-5 w-px shrink-0 bg-ink" />}
        {right && <span className="ml-auto pl-2 text-muted">{right}</span>}
      </div>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </div>
  );
}
const Select = (p: { id?: string; label: string; value?: string; focus?: boolean; hint?: string }) => <Input {...p} right={<ChevronDown className="size-4" />} />;

function Btn({ id, variant = "primary", className = "", children }: { id?: string; variant?: Parameters<typeof buttonClass>[0]; className?: string; children: ReactNode }) {
  return (
    <span data-tap={id} className={buttonClass(variant, `whitespace-nowrap ${className}`)}>
      {children}
    </span>
  );
}

function Dropdown({ items, pick, id, hl }: { items: string[]; pick: string; id: string; hl: boolean }) {
  return (
    <div className="d-pop absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
      {items.map((x) => (
        <div key={x} data-tap={x === pick ? id : undefined} className={`rounded-lg px-3 py-2 text-sm transition-colors ${x === pick && hl ? "bg-canvas font-medium" : ""}`}>
          {x}
        </div>
      ))}
    </div>
  );
}

// The app's page tabs: a grey track with a white selected pill and a lime underline.
function Tabs({ items, active, ids = {}, badges = {} }: { items: string[]; active: string; ids?: Record<string, string>; badges?: Record<string, number> }) {
  return (
    <div className="flex gap-1 overflow-hidden rounded-2xl bg-line/70 p-1">
      {items.map((x) => (
        <span
          key={x}
          data-tap={ids[x]}
          className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-colors duration-200 ${
            x === active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(13,17,23,0.08),0_2px_8px_rgba(13,17,23,0.06)] ring-1 ring-ink/5" : "text-muted"
          }`}
        >
          {x}
          {badges[x] ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold">{badges[x]}</span> : null}
          {x === active && <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-brand-strong" />}
        </span>
      ))}
    </div>
  );
}

function Toggle({ id, on }: { id?: string; on: boolean }) {
  return (
    <span data-tap={id} className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "bg-ink" : "bg-line"}`}>
      <span className={`size-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : ""}`} />
    </span>
  );
}

const Avatar = ({ children, lime = false }: { children: ReactNode; lime?: boolean }) => (
  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${lime ? "bg-brand" : "bg-canvas"}`}>{children}</span>
);

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </Card>
  );
}
const Td = ({ b = false, children }: { b?: boolean; children: ReactNode }) => <td className={`px-4 py-3 ${b ? "font-medium" : "text-muted"}`}>{children}</td>;

function Page({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="page-enter space-y-5">
      <PageHeader title={title} description={description} action={action} />
      {children}
    </div>
  );
}

function Dialog({ t, at, until, title, description, sheet = false, children }: { t: number; at: number; until?: number; title: string; description?: string; sheet?: boolean; children: ReactNode }) {
  if (t < at || (until !== undefined && t >= until)) return null;
  return (
    <div className={`d-fade absolute inset-0 z-30 flex bg-ink/40 ${sheet ? "items-end" : "items-center justify-center p-4"}`}>
      <div className={`${sheet ? "d-sheet w-full rounded-t-3xl pb-8" : "d-pop w-full max-w-md rounded-2xl"} bg-surface p-5 shadow-xl`}>
        {sheet && <div className="mx-auto -mt-1 mb-4 h-1 w-10 rounded-full bg-line" />}
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Toast({ t, at, dur = 2400, phone = false, children }: { t: number; at: number; dur?: number; phone?: boolean; children: ReactNode }) {
  if (t < at || t >= at + dur) return null;
  return (
    <div className={`toast-in absolute left-1/2 z-40 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg ${phone ? "bottom-[6.5rem]" : "bottom-6"}`}>
      <CheckCircle2 className="size-4 shrink-0 text-brand" />
      <span>{children}</span>
    </div>
  );
}

// "Ten days later" and the like: a small pill at the top while time jumps.
function Later({ t, at, until, children }: { t: number; at: number; until: number; children: ReactNode }) {
  return (
    <At t={t} at={at} until={until} anim="d-pop" className="absolute top-16 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink/90 px-3 py-1 text-xs font-medium whitespace-nowrap text-white shadow">
      {children}
    </At>
  );
}

// ---------------------------------------------------------------- shared sample screens
const MEMBERS: [string, string, string, "green" | "red" | "blue"][] = [
  ["Rami Haddad", "Monthly", "Active", "green"],
  ["Lara Nassar", "3 months", "Active", "green"],
  ["Karim Saad", "Monthly", "Frozen", "blue"],
  ["Elie Khoury", "Yearly", "Active", "green"],
  ["Tony Azar", "10 visits", "Expired", "red"],
];

function MemberTop({ right }: { right?: ReactNode }) {
  return (
    <div className="page-enter flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-brand text-base font-semibold">NK</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nour Khalil</h1>
          <p className="text-sm text-muted">+961 70 123 456 · member since Nov 2026</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function Tiles({ t, items }: { t: number; items: [string, number, boolean?, boolean?][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-5">
      {items.map(([label, v, dollars, alert]) => (
        <Card key={label} className="p-4">
          <p className="text-xs text-muted">{label}</p>
          <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${alert ? "text-danger" : ""}`}>
            {dollars ? "$" : ""}
            {num(count(v, t, 100))}
          </p>
        </Card>
      ))}
    </div>
  );
}

function Greeting() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted">Iron House</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hi Nour</h1>
      </div>
      <span className="grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line">
        <UserRound className="size-5" />
      </span>
    </div>
  );
}

function TodayCard({ empty = false }: { empty?: boolean }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-ink text-white">
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Today · Wednesday</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">{empty ? "Ready when you are" : "Day A · Legs"}</h2>
        <p className="mt-1 text-sm text-white/70">{empty ? "Get a program from a trainer or build your own." : "Build muscle · 5 exercises · about 40 min"}</p>
      </div>
      <div className="px-5 pb-5">
        <span data-tap="start" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-ink">
          {empty ? <Dumbbell className="size-5" /> : <Play className="size-5 fill-current" />} {empty ? "Free workout" : "Start workout"}
        </span>
      </div>
    </section>
  );
}

function WeekCard({ t = 1e9 }: { t?: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">This week</p>
          <p className="text-xl font-semibold tabular-nums">2 of 4 workouts</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold">
          <Flame className="size-4 text-orange-500" /> 6 weeks
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full bg-brand" style={{ width: `${50 * ease((t - 400) / 900)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, k) => (
          <div key={k} className="space-y-1">
            <span className={`block ${k === 2 ? "font-semibold text-ink" : "text-muted"}`}>{d}</span>
            <span className={`mx-auto block size-2 rounded-full ${[0, 2, 4, 5].includes(k) ? "bg-ink" : "bg-line"}`} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function MembershipCard({ badge = <Badge tone="green">Active</Badge>, until = "5 Dec 2026", left = "30", footer }: { badge?: ReactNode; until?: ReactNode; left?: string; footer?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Membership</p>
            <p className="text-lg font-semibold">Monthly</p>
          </div>
          {badge}
        </div>
        <div className="mt-3 flex gap-8 text-sm">
          <div>
            <p className="text-xs text-muted">Valid until</p>
            <div className="font-medium">{until}</div>
          </div>
          {left && (
            <div>
              <p className="text-xs text-muted">Days left</p>
              <p className="font-semibold tabular-nums">{left}</p>
            </div>
          )}
        </div>
      </div>
      {footer && <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">{footer}</div>}
    </Card>
  );
}

function LockWrap({ locked, children }: { locked: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      <div className={`transition duration-500 ${locked ? "pointer-events-none opacity-40 blur-[1.5px] grayscale" : ""}`}>{children}</div>
      {locked && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="d-pop inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-line">
            <Lock className="size-4" /> Opens with an active membership
          </span>
        </div>
      )}
    </div>
  );
}

function ProgCard({ name, meta, hl = false }: { name: string; meta: string; hl?: boolean }) {
  return (
    <Card className={`flex items-center gap-3 p-4 ${hl ? "d-rise border-brand-strong" : ""}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-canvas">
        <ClipboardList className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{name}</span>
        <span className="block truncate text-sm text-muted">{meta}</span>
      </span>
      <Pencil className="size-4 text-muted" />
      <Trash2 className="size-4 text-muted" />
    </Card>
  );
}

// A chat in the phone's messaging app, where Gymix's automatic WhatsApp messages land.
function WaChat({ t, children }: { t: number; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#efeae2]" data-t={t}>
      <div className="flex items-center gap-3 bg-surface px-4 pt-14 pb-3 shadow-sm">
        <ChevronLeft className="size-5" />
        <span className="grid size-9 place-items-center rounded-full bg-brand p-1.5 text-ink">
          <LogoMark className="size-full" />
        </span>
        <div>
          <p className="text-sm font-semibold">Gymix</p>
          <p className="text-xs text-muted">Business account</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 p-4">{children}</div>
    </div>
  );
}
function WaMsg({ t, at, time, children }: { t: number; at: number; time: string; children: ReactNode }) {
  return (
    <At t={t} at={at} anim="d-pop" className="max-w-[86%] origin-top-left rounded-xl rounded-tl-sm bg-surface px-3 py-2 text-sm shadow-sm">
      {children}
      <span className="mt-0.5 block text-right text-[10px] text-muted">{time}</span>
    </At>
  );
}
const WaDay = ({ children }: { children: ReactNode }) => <p className="mx-auto w-fit rounded-lg bg-white/80 px-2 py-0.5 text-[11px] text-muted">{children}</p>;

// The member app's header, drawn by full-screen scenes that start inside the app.
function MemberHeader({ bell = 0 }: { bell?: number }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
      <Logo />
      <div className="flex items-center gap-0.5">
        <span data-tap="scan" className="grid size-9 place-items-center rounded-lg">
          <ScanLine className="size-5" />
        </span>
        <span data-tap="bell" className="relative grid size-9 place-items-center rounded-lg">
          <span key={bell} className={bell ? "wiggle" : ""}>
            <Bell className="size-5" />
          </span>
          {bell > 0 && <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{bell}</span>}
        </span>
        <span className="h-9 px-3 text-sm leading-9 text-muted">Log out</span>
      </div>
    </div>
  );
}

const TABS = [
  ["Home", House],
  ["Train", Play],
  ["Schedule", CalendarDays],
  ["Progress", TrendingUp],
  ["More", Grid2x2],
] as const;
type TabKey = (typeof TABS)[number][0];

function BottomNav({ active, locked = false }: { active?: TabKey; locked?: boolean }) {
  return (
    <nav className="relative z-10 shrink-0 border-t border-line bg-surface/95 pb-5">
      <div className="grid h-[4.25rem] grid-cols-5">
        {TABS.map(([label, Icon]) => {
          const on = label === active;
          const lk = locked && label !== "Home" && label !== "More";
          return (
            <span key={label} data-tap={`tab-${label}`} className={`relative flex flex-col items-center justify-center gap-1 ${lk ? "text-muted/50" : on ? "text-ink" : "text-muted"}`}>
              <span className={`relative grid h-8 w-12 place-items-center rounded-full ${on ? "nav-bounce bg-brand" : ""}`}>
                <Icon className="size-5" strokeWidth={on ? 2.25 : 1.75} />
                {lk && <Lock className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-surface p-px" strokeWidth={2.5} />}
              </span>
              <span className="text-[11px] leading-none font-medium">{label}</span>
            </span>
          );
        })}
      </div>
    </nav>
  );
}

// The full check-in screens (the page a sticker tap opens).
function CheckScreen({ tone, children }: { tone: "good" | "bad" | "neutral"; children: ReactNode }) {
  const bg = { good: "bg-success", bad: "bg-danger", neutral: "bg-ink" }[tone];
  return <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white transition-colors duration-300 ${bg}`}>{children}</div>;
}
const Checking = () => (
  <div className="d-pop flex flex-col items-center gap-3">
    <Loader2 className="size-16 animate-spin" />
    <p className="text-2xl font-semibold">Checking you in…</p>
  </div>
);
function Welcome({ name, line }: { name: string; line: string }) {
  return (
    <div className="d-pop flex flex-col items-center gap-3">
      <CheckCircle2 className="size-20" />
      <p className="text-sm font-medium uppercase tracking-widest opacity-80">Checked in</p>
      <p className="text-4xl font-bold">Welcome back, {name}</p>
      <p className="text-base opacity-90">{line}</p>
      <span className={buttonClass("secondary", "mt-6 h-12 px-8 text-base")}>Start training</span>
      <p className="text-xs opacity-75">Opening your training screen…</p>
    </div>
  );
}

// Cracks for the dropped-phone scene, radiating from one point (like the app's).
const CRACKS = [
  "M48 42 L30 20 L22 4",
  "M48 42 L70 28 L92 18",
  "M48 42 L80 52 L100 60",
  "M48 42 L56 70 L60 100",
  "M48 42 L28 62 L6 74",
  "M48 42 L34 40 L4 36",
  "M30 20 L38 12",
  "M80 52 L84 66",
  "M28 62 L22 50",
  "M44 38 L52 38 L53 46 L45 47 Z",
];

// ---------------------------------------------------------------- the tour
type Step = {
  title: string;
  who: string;
  what: string;
  start: string[];
  tip?: string;
  page?: NavKey; // staff feature: plays inside the dashboard, on this page
  tab?: TabKey; // member feature inside the app's header and tab bar; neither = full screen
  dark?: boolean; // full-screen scene on a dark background (white status bar)
  locked?: boolean;
  bell?: (t: number) => number;
  device?: (t: number) => string; // moves the whole phone (shake, drop)
  cursor?: string; // a label next to the cursor
  taps?: Tap[];
  end: number; // when the scene is done, in ms
  scene: (t: number) => ReactNode;
};
type Chapter = { name: string; steps: Step[] };

const NAV = [
  ["Overview", LayoutDashboard],
  ["Check-in", ScanLine],
  ["Members", UserRound],
  ["Schedule", CalendarDays],
  ["Messages", MessageCircle],
  ["Programs", ClipboardList],
  ["Nutrition", Apple],
  ["Equipment", Dumbbell],
  ["Billing", Receipt],
  ["Plans", Tags],
  ["Team", Users],
  ["Settings", Settings],
] as const;
type NavKey = (typeof NAV)[number][0];

const SETTINGS_TABS = ["Gym", "Member app", "Check-in sticker", "Subscription"];

const CHAPTERS: Chapter[] = [
  {
    name: "Set up your gym",
    steps: [
      {
        title: "Create your gym",
        who: "Owner · 1 minute",
        what: "Sign up, name your gym and you're its owner. Your team, members, plans and money all live inside your gym and nobody else's. You get 14 days free with every feature, and no card is needed.",
        start: ["On the website, press Start free trial.", "Confirm your email, then name your gym."],
        tip: "The Overview shows a Get set up list. Work down it and you're ready.",
        page: "Overview",
        taps: [{ at: 1900, id: "create" }],
        end: 4200,
        scene: (t) =>
          t < 2300 ? (
            <div className="page-enter mx-auto max-w-md pt-6">
              <Card className="space-y-4 p-6">
                <div>
                  <h1 className="text-xl font-semibold">Create your gym</h1>
                  <p className="text-sm text-muted">You&apos;ll be its owner. You can change everything later.</p>
                </div>
                <Input label="Gym name" placeholder="e.g. Iron House" value={typed("Iron House", t, 300, 10)} focus={t < 1800} />
                <Btn id="create" className="w-full">
                  Create gym
                </Btn>
              </Card>
            </div>
          ) : (
            <Page title="Overview" description="Your gym today.">
              <Tiles t={t - 2300} items={[["Active members", 0], ["Check-ins today", 0], ["Expiring in 7 days", 0], ["Collected this month", 0, true], ["Owed by members", 0, true]]} />
              <At t={t} at={2600}>
                <Card className="p-5">
                  <h2 className="font-semibold">Get set up</h2>
                  <ul className="mt-3 space-y-2">
                    {[
                      "Add your machines and equipment (members can only use what you add)",
                      "Create your membership plans",
                      "Add your first member and sell a membership",
                      "Set up the tap-to-check-in sticker",
                    ].map((s) => (
                      <li key={s} className="flex items-center gap-3 text-sm">
                        <Circle className="size-5 shrink-0 text-muted" />
                        <span className="font-medium underline underline-offset-4">{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </At>
            </Page>
          ),
      },
      {
        title: "Your lira rate and gym rules",
        who: "Owner · 1 minute",
        what: "Prices in Gymix are in dollars. You set your own lira rate, and the front desk uses it whenever someone pays in lira. Change it whenever the market moves. Here you also choose how many days an unpaid member has before they are frozen, and when the WhatsApp renewal reminder goes out.",
        start: ["Settings → Gym.", "Enter the lira rate, the days to pay and the reminder days, then Save."],
        tip: "Update the rate in the morning and the whole front desk uses it straight away.",
        page: "Settings",
        taps: [
          { at: 500, id: "rate" },
          { at: 2700, id: "save" },
        ],
        end: 4000,
        scene: (t) => (
          <Page title="Settings">
            <Tabs items={SETTINGS_TABS} active="Gym" />
            <Card className="space-y-4 p-5">
              <Input id="rate" label="Lira rate (LBP per $1)" value={t < 600 ? "89,000" : typed("89,500", t, 700, 8)} focus={t >= 500 && t < 2600} />
              <Input
                label="Days to pay before freezing"
                value="3"
                hint="A member who still owes money this many days after an invoice is frozen: their app shows only its home page and check-in is refused until they pay."
              />
              <Input label="WhatsApp renewal reminder (days before)" value="3" />
              <Btn id="save">Save</Btn>
            </Card>
            <Toast t={t} at={2850}>
              Settings saved
            </Toast>
          </Page>
        ),
      },
      {
        title: "Membership plans",
        who: "Owner or manager · 2 minutes",
        what: "Create every way you sell your gym: monthly, quarterly, yearly or visit packs (a punch card like 10 visits). Each plan has a price in dollars and a length. When you sell one, Gymix works out the end date or counts the visits, and knows exactly when it runs out.",
        start: ["Plans → New plan.", "Name it, set the length or the visits, and the price."],
        tip: "A cheap visit pack is a great way to let people try the gym. Many upgrade.",
        page: "Plans",
        taps: [
          { at: 800, id: "new" },
          { at: 3500, id: "create" },
        ],
        end: 4800,
        scene: (t) => (
          <Page
            title="Membership plans"
            description="What you sell at the front desk. Prices are in USD."
            action={
              <Btn id="new">
                <Plus className="size-4" /> New plan
              </Btn>
            }
          >
            <Table head={["Plan", "Length", "Price", "Status"]}>
              {t >= 3700 && (
                <tr className="d-rise bg-brand/15">
                  <Td b>Summer pass</Td>
                  <Td>2 months</Td>
                  <Td>$80</Td>
                  <Td>
                    <Badge tone="green">On sale</Badge>
                  </Td>
                </tr>
              )}
              {[
                ["Monthly", "1 month", "$45"],
                ["3 months", "3 months", "$120"],
                ["Yearly", "12 months", "$420"],
                ["10 visits", "10 visits", "$30"],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <Td b>{a}</Td>
                  <Td>{b}</Td>
                  <Td>{c}</Td>
                  <Td>
                    <Badge tone="green">On sale</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
            <Dialog t={t} at={1000} until={3700} title="New plan" description="Monthly, yearly, or a punch card with a visit limit.">
              <Input label="Plan name" value={typed("Summer pass", t, 1300, 12)} focus={t >= 1100 && t < 2400} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Length" value="2" />
                <Select label="Length unit" value="Months" />
              </div>
              <Input label="Price (USD)" value={typed("80", t, 2600, 6)} focus={t >= 2400} />
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="create">Create plan</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3750}>
              Plan created
            </Toast>
          </Page>
        ),
      },
      {
        title: "Your equipment",
        who: "Owner or manager · 5 minutes",
        what: "List the machines and equipment your gym really has: leg press, cables, dumbbells, bikes. Every machine comes with its exercises and a how-to. Programs only use exercises for this equipment, so a trainer (or a member building their own) never gets an exercise on a machine you don't have.",
        start: ["Equipment → Add a machine.", "Search for it and pick it from the list."],
        tip: "Do this before your trainers start building programs.",
        page: "Equipment",
        taps: [
          { at: 800, id: "add" },
          { at: 2600, id: "opt" },
        ],
        end: 4200,
        scene: (t) => (
          <Page
            title="Equipment"
            description="What your gym has. Trainers and members build programs from these exercises, each with a how-to."
            action={
              <Btn id="add">
                <Plus className="size-4" /> Add a machine
              </Btn>
            }
          >
            <Card className="flex items-center justify-between p-4">
              <span className="text-sm text-muted">Exercises available at your gym</span>
              <span className="text-2xl font-semibold tabular-nums">{64 + (t >= 2800 ? count(5, t, 2800, 600) : 0)}</span>
            </Card>
            <Tabs items={["Machines", "Free weights & equipment"]} active="Machines" />
            <Card>
              <ul className="divide-y divide-line">
                {t >= 2800 && (
                  <li className="d-rise flex items-center gap-3 bg-brand/15 px-4 py-2.5 text-sm">
                    <ExerciseAnimation paths={["Leg_Press/0.jpg", "Leg_Press/1.jpg"]} name="Leg press" className="size-10" />
                    <span className="flex-1 font-medium">Leg press</span>
                    <span className="text-xs text-muted">5 exercises</span>
                  </li>
                )}
                {[
                  ["Lat pulldown", 6],
                  ["Chest press", 4],
                  ["Cable crossover", 9],
                  ["Smith machine", 8],
                ].map(([m, c]) => (
                  <li key={m} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <ExerciseAnimation paths={null} name={String(m)} className="size-10" />
                    <span className="flex-1 font-medium">{m}</span>
                    <span className="text-xs text-muted">{c} exercises</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Dialog t={t} at={1000} until={2800} title="Add a machine">
              <Input label="Machine" placeholder="Search machines" value={typed("Leg", t, 1300, 6)} focus right={<Search className="size-4" />} />
              <At t={t} at={1700}>
                <ul className="space-y-1">
                  {["Leg press", "Leg extension", "Lying leg curl"].map((m, k) => (
                    <li key={m} data-tap={k === 0 ? "opt" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${k === 0 && t >= 2450 ? "bg-canvas font-medium" : ""}`}>
                      <Dumbbell className="size-4 text-muted" />
                      {m}
                    </li>
                  ))}
                </ul>
              </At>
            </Dialog>
            <Toast t={t} at={2850}>
              Leg press added with 5 exercises
            </Toast>
          </Page>
        ),
      },
      {
        title: "Invite your team",
        who: "Owner",
        what: "Invite managers, front desk, trainers and a dietitian by email. Each role sees only what it needs: trainers see their classes and clients but no money, the front desk sells memberships and takes payments, managers run almost everything. The invite is claimed as soon as that person signs up.",
        start: ["Team → Invite team member.", "Type their email, choose the role, send."],
        tip: "Owners can invite anyone. Managers can invite front desk, trainers and dietitians. The front desk can only add members.",
        page: "Team",
        taps: [
          { at: 800, id: "inv" },
          { at: 2400, id: "role" },
          { at: 3000, id: "opt" },
          { at: 3600, id: "send" },
        ],
        end: 5000,
        scene: (t) => (
          <Page
            title="Team"
            description="Your managers, front desk and trainers. Members are on the Members page."
            action={
              <Btn id="inv">
                <Plus className="size-4" /> Invite team member
              </Btn>
            }
          >
            <Tabs items={["Staff", "Pending invites"]} active="Staff" badges={t >= 3800 ? { "Pending invites": 1 } : {}} />
            <Card>
              <ul className="divide-y divide-line">
                {[
                  ["MS", "Maya Saliba", "maya@ironhouse.lb", "Owner"],
                  ["JN", "Joe Nassif", "joe@ironhouse.lb", "Front desk"],
                  ["ZK", "Ziad Khoury", "ziad@ironhouse.lb", "Trainer"],
                ].map(([i, n, e, r]) => (
                  <li key={n} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Avatar>{i}</Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{n}</span>
                      <span className="block truncate text-xs text-muted">{e}</span>
                    </span>
                    <Badge tone="gray">{r}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Dialog t={t} at={1000} until={3800} title="Invite a team member" description="They get a link to create their account and land straight in your gym.">
              <Input label="Email" value={typed("rita@ironhouse.lb", t, 1200, 16)} focus={t >= 1100 && t < 2400} />
              <div className="relative">
                <Select id="role" label="Role" value={t >= 3000 ? "Dietitian" : "Front desk"} focus={t >= 2400 && t < 3050} />
                {t >= 2450 && t < 3050 && <Dropdown items={["Manager", "Front desk", "Trainer", "Dietitian"]} pick="Dietitian" id="opt" hl={t >= 2900} />}
              </div>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="send">Send invite</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3850}>
              Invite sent to rita@ironhouse.lb
            </Toast>
          </Page>
        ),
      },
      {
        title: "Choose what members see",
        who: "Owner",
        what: "You decide which pages the member app shows: training, schedule, progress, programs, nutrition, machines and chat. No dietitian? Turn nutrition off and it disappears from every member's app. Members only see what your gym really offers.",
        start: ["Settings → Member app.", "Switch pages on or off, then Save."],
        page: "Settings",
        taps: [
          { at: 1200, id: "tg" },
          { at: 2300, id: "save" },
        ],
        end: 3600,
        scene: (t) => (
          <Page title="Settings">
            <Tabs items={SETTINGS_TABS} active="Member app" />
            <Card className="p-5">
              <h2 className="font-semibold">Member portal pages</h2>
              <p className="text-sm text-muted">Hide what your gym doesn&apos;t offer. Home is always on.</p>
              <ul className="mt-3 divide-y divide-line">
                {["Train", "Schedule", "Progress", "Programs", "Nutrition", "Machines", "Chat"].map((p) => (
                  <li key={p} className="flex items-center justify-between py-2.5 text-sm">
                    <span>{p}</span>
                    <Toggle id={p === "Nutrition" ? "tg" : undefined} on={p !== "Nutrition" || t < 1250} />
                  </li>
                ))}
              </ul>
              <Btn id="save" className="mt-3">
                Save
              </Btn>
            </Card>
            <Toast t={t} at={2450}>
              Member app updated
            </Toast>
          </Page>
        ),
      },
    ],
  },
  {
    name: "Members and money",
    steps: [
      {
        title: "Add a member",
        who: "Front desk · 30 seconds",
        what: "Only the name is required; add the phone number so Gymix can send them their app. Each member gets a profile with their memberships, payments, visits, programs and chat in one place. Search by name, phone or member code to find anyone in seconds.",
        start: ["Members → Add member."],
        tip: "Add members as they walk in. You don't need everyone on day one.",
        page: "Members",
        taps: [
          { at: 800, id: "add" },
          { at: 2200, id: "phone" },
          { at: 3500, id: "save" },
        ],
        end: 5000,
        scene: (t) => (
          <Page
            title="Members"
            description="Everyone with a membership at your gym, with or without a portal account."
            action={
              <Btn id="add">
                <Plus className="size-4" /> Add member
              </Btn>
            }
          >
            <Tabs items={["All", "Active", "Expired", "Owing money"]} active="All" />
            <Table head={["Member", "Membership", "Status"]}>
              {t >= 3700 && (
                <tr className="d-rise bg-brand/15">
                  <Td b>
                    Nour Khalil<span className="block text-xs font-normal text-muted">70 123 456</span>
                  </Td>
                  <Td>None</Td>
                  <Td>
                    <Badge tone="gray">No membership</Badge>
                  </Td>
                </tr>
              )}
              {MEMBERS.map(([n, p, s, tone]) => (
                <tr key={n}>
                  <Td b>{n}</Td>
                  <Td>{p}</Td>
                  <Td>
                    <Badge tone={tone}>{s}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
            <Dialog t={t} at={1000} until={3700} title="Add member" description="Only the name is required. You can sell a membership on the next screen.">
              <Input label="Full name" placeholder="e.g. Rami Haddad" value={typed("Nour Khalil", t, 1300, 12)} focus={t >= 1100 && t < 2200} />
              <Input id="phone" label="Phone" placeholder="71 123 456" value={typed("70 123 456", t, 2400, 12)} focus={t >= 2200 && t < 3400} />
              <span className="flex items-center gap-2 text-sm">
                <span className="grid size-5 place-items-center rounded-md bg-ink text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                Give them the member app
              </span>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="save">Add member</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3750}>
              Nour Khalil added. Login link sent on WhatsApp.
            </Toast>
          </Page>
        ),
      },
      {
        title: "Their app arrives on WhatsApp",
        who: "Automatic",
        what: "As soon as you add a member with a phone number, Gymix sends them a WhatsApp message with a personal link. One tap opens their app, already logged in. No App Store, no download, no password to remember. They can add it to their home screen like any other app, on iPhone and Android.",
        start: ["Nothing to do: it's sent when you add the member.", "You can also copy the link from the member's page and send it yourself."],
        taps: [{ at: 2300, id: "link" }],
        end: 5200,
        scene: (t) => (
          <>
            <WaChat t={t}>
              <WaDay>Today</WaDay>
              <WaMsg t={t} at={500} time="09:41">
                Hi Nour, Iron House has set up your Gymix account. Open your portal:{" "}
                <span data-tap="link" className="text-sky-700 underline">
                  gymix.app/join/8fk2…
                </span>
              </WaMsg>
            </WaChat>
            {t >= 2600 && (
              <div className="d-pop absolute inset-0 flex flex-col bg-canvas pt-12">
                <MemberHeader />
                <div className="stagger space-y-4 px-4 pt-5">
                  <Greeting />
                  <TodayCard empty />
                  <WeekCard t={t - 2600} />
                </div>
                <At t={t} at={3400} anim="d-sheet" className="absolute inset-x-3 bottom-6 rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-line">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand p-2 text-ink">
                      <LogoMark className="size-full" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Add Gymix to your Home Screen</p>
                      <p className="text-xs text-muted">Opens full screen, like any app.</p>
                    </div>
                  </div>
                </At>
              </div>
            )}
          </>
        ),
      },
      {
        title: "Logging in later",
        who: "Member and front desk",
        what: "The first link signs them straight in, and Gymix shows them a password once. After that they log in anywhere with their email, phone number or member code and that password. Forgot it? The front desk resets it from the member's page in one click.",
        start: ["Member page → Reset password, if they ever need it."],
        taps: [
          { at: 1600, id: "pw" },
          { at: 2900, id: "login" },
        ],
        end: 4800,
        scene: (t) => (
          <div className="absolute inset-0 flex flex-col justify-center bg-canvas px-5">
            {t < 3200 ? (
              <div className="page-enter space-y-6">
                <div className="flex justify-center">
                  <Logo className="text-2xl" />
                </div>
                <Card className="space-y-4 p-6">
                  <div>
                    <h1 className="text-xl font-semibold">Welcome back</h1>
                    <p className="text-sm text-muted">Log in to your gym.</p>
                  </div>
                  <Input label="Email, phone or member code" value={typed("70 123 456", t, 300, 10)} focus={t < 1600} />
                  <Input id="pw" label="Password" value={typed("gymix-7413", t, 1800, 10)} focus={t >= 1600 && t < 2900} secret />
                  <Btn id="login" className="h-11 w-full">
                    Log in
                  </Btn>
                  <p className="text-center text-sm text-muted underline underline-offset-4">Forgot password?</p>
                </Card>
              </div>
            ) : (
              <div className="d-pop absolute inset-0 flex flex-col bg-canvas pt-12">
                <MemberHeader />
                <div className="stagger space-y-4 px-4 pt-5">
                  <Greeting />
                  <TodayCard />
                  <MembershipCard />
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Sell a membership",
        who: "Front desk",
        what: "Pick a plan and a start date and Gymix creates the membership and its invoice. Take the payment straight away or later. The end date, or the visits left, shows in the member's app, and a receipt goes out on WhatsApp.",
        start: ["Member page → Sell membership.", "Choose the plan, how they paid, then Sell membership."],
        page: "Members",
        taps: [
          { at: 800, id: "sell" },
          { at: 1400, id: "plan" },
          { at: 2100, id: "opt" },
          { at: 3300, id: "ok" },
        ],
        end: 5000,
        scene: (t) => (
          <div className="space-y-5">
            <MemberTop
              right={
                <div className="flex gap-2">
                  <Btn id="sell">Sell membership</Btn>
                  <Btn variant="secondary">Record payment</Btn>
                </div>
              }
            />
            <Card className="p-5">
              <p className="text-sm text-muted">Current membership</p>
              {t < 3500 ? (
                <p className="mt-1 text-lg font-semibold">No membership yet</p>
              ) : (
                <div className="d-rise mt-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold">Monthly</p>
                    <Badge tone="green">Active</Badge>
                  </div>
                  <div className="flex gap-8 text-sm">
                    <div>
                      <p className="text-xs text-muted">Valid until</p>
                      <p className="font-medium">5 Dec 2026</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Days left</p>
                      <p className="font-semibold">30</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle>Invoices</SectionTitle>
              {t < 3500 ? (
                <p className="px-5 pb-5 text-sm text-muted">No invoices yet.</p>
              ) : (
                <div className="d-rise flex items-center justify-between border-t border-line px-5 py-2.5 text-sm">
                  <span>
                    Monthly membership<span className="block text-xs text-muted">#1042 · 5 Nov 2026</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium">$45.00</span>
                    <Badge tone="green">Paid</Badge>
                  </span>
                </div>
              )}
            </Card>
            <Dialog t={t} at={1000} until={3500} title="Sell a membership" description="Nour Khalil">
              <div className="relative">
                <Select id="plan" label="Plan" value={t >= 2100 ? "Monthly · $45" : "Choose a plan"} focus={t >= 1400 && t < 2150} />
                {t >= 1450 && t < 2150 && <Dropdown items={["Monthly · $45", "3 months · $120", "Yearly · $420", "10 visits · $30"]} pick="Monthly · $45" id="opt" hl={t >= 2000} />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Starts on" value="5 Nov 2026" />
                <Input label="Discount (USD)" value="0" />
              </div>
              <Select label="Paid by" value="Cash (USD)" />
              <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
                <span className="text-muted">Total</span>
                <b className="text-lg">{t >= 2100 ? "$45.00" : "$0.00"}</b>
              </div>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="ok">Sell membership</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3550}>
              Membership sold. Receipt sent on WhatsApp.
            </Toast>
          </div>
        ),
      },
      {
        title: "Payments in dollars and lira",
        who: "Front desk",
        what: "Record payments in cash dollars, cash lira at your rate, card, Whish Money, OMT or bank transfer. Pick lira and Gymix works out the amount at your rate, so nobody needs a calculator. Part payments are fine: what's left stays on the invoice as owed.",
        start: ["Member page → Record payment."],
        tip: "Every payment sends the member a WhatsApp receipt automatically.",
        page: "Members",
        taps: [
          { at: 800, id: "pay" },
          { at: 1600, id: "method" },
          { at: 2300, id: "lbp" },
          { at: 3700, id: "ok" },
        ],
        end: 5200,
        scene: (t) => (
          <div className="space-y-5">
            <MemberTop
              right={
                <div className="flex gap-2">
                  <Btn variant="secondary">Sell membership</Btn>
                  <Btn id="pay">Record payment</Btn>
                </div>
              }
            />
            <Card>
              <SectionTitle>Invoices</SectionTitle>
              <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-sm">
                <span>
                  Monthly membership<span className="block text-xs text-muted">#1042 · 5 Nov 2026</span>
                </span>
                <span className="text-right">
                  <span className="block font-medium">$45.00</span>
                  {t >= 3900 ? (
                    <span className="d-pop inline-block">
                      <Badge tone="green">Paid</Badge>
                    </span>
                  ) : (
                    <Badge tone="red">Unpaid</Badge>
                  )}
                </span>
              </div>
            </Card>
            <Dialog t={t} at={1000} until={3900} title="Record payment" description="Nour Khalil · invoice #1042">
              <Input label="Amount (USD)" value="45.00" />
              <div className="relative">
                <Select id="method" label="Paid by" value={t >= 2300 ? "Cash (LBP)" : "Cash (USD)"} focus={t >= 1600 && t < 2350} />
                {t >= 1650 && t < 2350 && <Dropdown items={["Cash (USD)", "Cash (LBP)", "Card", "Whish Money", "OMT", "Bank transfer"]} pick="Cash (LBP)" id="lbp" hl={t >= 2200} />}
              </div>
              {t >= 2350 && (
                <div className="d-rise">
                  <Input label="Received in LBP" value={num(count(4027500, t, 2400))} hint="At your rate: 89,500 LBP per $1" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="ok">Record payment</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3950}>
              Payment recorded. Receipt sent on WhatsApp.
            </Toast>
          </div>
        ),
      },
      {
        title: "Billing: who owes what",
        who: "Owner, manager, front desk",
        what: "One place for every unpaid invoice and every payment. See what you collected this month, who owes you and how much, and which payment methods people use. Tap a name to collect. Trainers and dietitians can't see this page.",
        start: ["Billing."],
        page: "Billing",
        taps: [{ at: 2700, id: "tpay" }],
        end: 4400,
        scene: (t) => (
          <Page title="Billing" description="Invoices are created when you sell a membership. All amounts in USD.">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-muted">Collected this month</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums">${num(count(6240, t, 200))}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted">Owed by members</p>
                <p className="mt-1.5 text-2xl font-semibold text-danger tabular-nums">${num(count(195, t, 200))}</p>
              </Card>
            </div>
            <Tabs items={["Owing", "All invoices", "Payments"]} active={t >= 2750 ? "Payments" : "Owing"} ids={{ Payments: "tpay" }} />
            {t < 2750 ? (
              <Table head={["Member", "Invoice", "Owes"]}>
                {[
                  ["Karim Saad", "#1031 · 6 days late", "$45"],
                  ["Lea Haddad", "#1038 · 2 days late", "$120"],
                  ["Tony Azar", "#1040 · today", "$30"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <Td b>{a}</Td>
                    <Td>{b}</Td>
                    <Td>
                      <span className="font-medium text-danger">{c}</span>
                    </Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="contents tab-enter">
                <Table head={["Member", "Paid by", "Amount"]}>
                  {[
                    ["Nour Khalil", "Cash (LBP)", "$45"],
                    ["Rami Haddad", "Whish Money", "$45"],
                    ["Lara Nassar", "Card", "$120"],
                    ["Elie Khoury", "OMT", "$420"],
                  ].map(([a, b, c]) => (
                    <tr key={a}>
                      <Td b>{a}</Td>
                      <Td>{b}</Td>
                      <Td>{c}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Page>
        ),
      },
      {
        title: "Unpaid? Frozen. Automatically.",
        who: "Runs by itself",
        what: "If a member still owes money a few days after an invoice (3 by default, you choose), Gymix freezes them. Their check-in is refused at the door with a message to see the front desk, and their app only opens its home page. As soon as they pay, their next tap lets them in. No awkward conversations.",
        start: ["Settings → Gym → Days to pay before freezing."],
        tip: "This alone usually pays for Gymix in the first month.",
        dark: true,
        end: 5600,
        scene: (t) => (
          <>
            <CheckScreen tone={t < 900 || (t >= 3500 && t < 4100) ? "neutral" : t < 3500 ? "bad" : "good"}>
              {t < 900 || (t >= 3500 && t < 4100) ? (
                <Checking key={t < 900 ? "a" : "b"} />
              ) : t < 3500 ? (
                <div className="d-pop flex flex-col items-center gap-3">
                  <XCircle className="size-20" />
                  <p className="text-3xl font-bold">Not allowed in</p>
                  <p className="text-lg font-medium">Karim Saad</p>
                  <p className="max-w-xs text-base opacity-90">Unpaid balance of $45. Please see the front desk.</p>
                  <span className={buttonClass("secondary", "mt-4")}>Go to my portal</span>
                </div>
              ) : (
                <Welcome name="Karim" line="Monthly · until 5 Dec" />
              )}
            </CheckScreen>
            <Later t={t} at={3200} until={4300}>
              After paying at the front desk
            </Later>
          </>
        ),
      },
      {
        title: "Freeze, resume and renew",
        who: "Front desk or manager",
        what: "A member is injured or travelling? Freeze their membership: they can't check in while it's frozen, and when you resume it the frozen days are added to the end date. When a membership ends, renew it in one tap.",
        start: ["Member page → the ⋯ button on the membership → Freeze, Renew or Cancel."],
        page: "Members",
        taps: [
          { at: 800, id: "menu" },
          { at: 1500, id: "fr" },
          { at: 2400, id: "ok" },
          { at: 4000, id: "res" },
        ],
        end: 5600,
        scene: (t) => {
          const frozen = t >= 2550 && t < 4100;
          const resumed = t >= 4100;
          return (
            <div className="space-y-5">
              <MemberTop right={frozen ? <Badge tone="blue">Frozen</Badge> : <Badge tone="green">Active</Badge>} />
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">Current membership</p>
                    <p className="text-lg font-semibold">Monthly</p>
                  </div>
                  <div className="relative flex items-center gap-2">
                    {frozen ? <Badge tone="blue">Frozen</Badge> : <Badge tone="green">Active</Badge>}
                    {frozen ? (
                      <Btn id="res" className="h-9">
                        Resume
                      </Btn>
                    ) : (
                      <span data-tap="menu" className="grid size-9 place-items-center rounded-lg border border-line bg-surface">
                        <MoreHorizontal className="size-4" />
                      </span>
                    )}
                    {t >= 850 && t < 1550 && (
                      <div className="d-pop absolute top-full right-0 z-10 mt-1 w-40 rounded-xl border border-line bg-surface p-1 shadow-lg">
                        {["Freeze", "Renew", "Cancel"].map((x) => (
                          <div key={x} data-tap={x === "Freeze" ? "fr" : undefined} className={`rounded-lg px-3 py-2 text-sm ${x === "Cancel" ? "text-danger" : ""} ${x === "Freeze" && t >= 1400 ? "bg-canvas" : ""}`}>
                            {x}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-8 text-sm">
                  <div>
                    <p className="text-xs text-muted">Valid until</p>
                    <p key={resumed ? "r" : "a"} className={`font-medium ${resumed ? "d-pop text-success" : ""}`}>
                      {resumed ? "15 Dec 2026" : "5 Dec 2026"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">{frozen ? "Frozen since" : "Days left"}</p>
                    <p className="font-semibold">{frozen ? "5 Nov" : "30"}</p>
                  </div>
                </div>
              </Card>
              <Dialog t={t} at={1600} until={2550} title="Freeze this membership?" description="They can't check in while it's frozen. When you resume it, the frozen days are added to the end date.">
                <div className="flex justify-end gap-2">
                  <Btn variant="secondary">Cancel</Btn>
                  <Btn id="ok">Freeze</Btn>
                </div>
              </Dialog>
              <Later t={t} at={3000} until={4200}>
                10 days later
              </Later>
              <Toast t={t} at={2600} dur={1300}>
                Membership frozen
              </Toast>
              <Toast t={t} at={4150}>
                Resumed. 10 days added to the end date.
              </Toast>
            </div>
          );
        },
      },
      {
        title: "Expiring soon",
        who: "Owner, manager, front desk",
        what: "The Overview lists everyone whose membership ends in the next 7 days, with their phone number, so you can call them before they leave. Gymix also messages them on WhatsApp a few days before it ends.",
        start: ["Overview → Memberships ending this week."],
        page: "Overview",
        end: 3200,
        scene: (t) => (
          <Page title="Overview" description="Your gym today.">
            <Tiles t={t} items={[["Active members", 412], ["Check-ins today", 126], ["Expiring in 7 days", 18], ["Collected this month", 6240, true], ["Owed by members", 195, true, true]]} />
            <Card>
              <SectionTitle>Memberships ending this week</SectionTitle>
              <ul className="stagger divide-y divide-line border-t border-line">
                {[
                  ["Rami Haddad", "Monthly · ends 7 Nov · 70 111 222", "2 days", "red"],
                  ["Lara Nassar", "3 months · ends 9 Nov · 71 333 444", "4 days", "amber"],
                  ["Elie Khoury", "Monthly · ends 11 Nov · 76 555 666", "6 days", "amber"],
                ].map(([n, d, b, tone]) => (
                  <li key={n} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{n}</span>
                      <span className="block truncate text-xs text-muted">{d}</span>
                    </span>
                    <Badge tone={tone as "red" | "amber"}>{b}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </Page>
        ),
      },
    ],
  },
  {
    name: "Check-in",
    steps: [
      {
        title: "Tap to check in (NFC)",
        who: "Owner · one-time setup",
        what: "Buy NFC stickers (about $1 each) and write your gym's check-in link onto one from your phone, right inside Gymix. Stick it at the entrance. Members hold their phone to it and they're checked in. No turnstile, no card reader, no hardware to buy.",
        start: ["Settings → Check-in sticker → Write.", "Stick it at the entrance."],
        tip: "Put a second sticker at the front desk for busy hours.",
        dark: true,
        taps: [{ at: 2100, id: "banner" }],
        end: 5000,
        scene: (t) => (
          <CheckScreen tone={t < 2900 ? "neutral" : "good"}>
            {t < 2300 ? (
              <div className="flex flex-col items-center gap-8">
                <div className="relative grid size-40 place-items-center">
                  {[0, 1, 2].map((k) => {
                    const p = ((t / 1400 + k / 3) % 1 + 1) % 1;
                    return <span key={k} className="absolute inset-0 rounded-[2.25rem] border-2 border-brand" style={{ transform: `scale(${1 + p * 0.7})`, opacity: 1 - p }} />;
                  })}
                  <span className="grid size-40 place-items-center rounded-[2.25rem] bg-brand p-8 text-ink shadow-[0_0_60px_-10px_rgba(200,241,53,0.7)]">
                    <LogoMark className="size-full" />
                  </span>
                </div>
                <p className="max-w-[16rem] text-base text-white/70">Hold your phone near the Gymix sticker at the entrance</p>
              </div>
            ) : t < 2900 ? (
              <Checking />
            ) : (
              <Welcome name="Nour" line="Monthly · until 5 Dec" />
            )}
            {t >= 1300 && t < 2300 && (
              <div className="d-drop absolute inset-x-3 top-12 flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-left text-ink shadow-xl" data-tap="banner">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand p-2">
                  <LogoMark className="size-full" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">NFC tag</span>
                  <span className="block text-xs text-muted">Open gymix.app to check in</span>
                </span>
              </div>
            )}
          </CheckScreen>
        ),
      },
      {
        title: "QR check-in",
        who: "Member",
        what: "Phone without NFC? Print your gym's QR code from Gymix and put it next to the sticker. Members scan it with the scanner button at the top of their app and get the same check-in. Both ways check the membership and payment before letting anyone in.",
        start: ["Settings → Check-in sticker → print the QR code."],
        taps: [{ at: 900, id: "scan" }],
        end: 5000,
        scene: (t) => (
          <div className="absolute inset-0 flex flex-col bg-canvas pt-12">
            <MemberHeader />
            <div className="flex-1 space-y-4 px-4 pt-5">
              <Greeting />
              <TodayCard />
            </div>
            <BottomNav active="Home" />
            {t >= 1100 && t < 2900 && (
              <div className="d-fade absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black text-white">
                <div className="relative grid size-64 place-items-center rounded-3xl border-2 border-white/80">
                  <span className="grid size-44 place-items-center rounded-2xl bg-white p-3 text-ink">
                    <QrCode className="size-full" strokeWidth={1.25} />
                  </span>
                  <span className="scan-line absolute inset-x-4 h-0.5 rounded-full bg-brand shadow-[0_0_12px_rgba(200,241,53,0.9)]" />
                </div>
                <p className="text-sm text-white/80">Point your camera at the Gymix QR code</p>
              </div>
            )}
            {t >= 2900 && (
              <CheckScreen tone="good">
                <Welcome name="Nour" line="10 visits · 9 left" />
              </CheckScreen>
            )}
          </div>
        ),
      },
      {
        title: "Check-in log",
        who: "Front desk and owner",
        what: "Every check-in appears as it happens: who came in and when, and who was refused and why (unpaid, expired, no visits left). The front desk can also find anyone by name and check them in by hand.",
        start: ["Check-in."],
        page: "Check-in",
        taps: [
          { at: 2500, id: "search" },
          { at: 3900, id: "ci" },
        ],
        end: 5400,
        scene: (t) => {
          const rows: [number, string, string, boolean, string?][] = [
            [4000, "08:14", "Tony Azar", true],
            [2000, "08:12", "Nour Khalil", true],
            [1300, "08:11", "Karim Saad", false, "Unpaid balance"],
            [600, "08:09", "Rami Haddad", true],
            [0, "08:01", "Lea Haddad", true],
          ];
          return (
            <Page title="Check-in" description="Members tap their phone on the Gymix sticker at the entrance. Check anyone else in here.">
              <Card className="p-4">
                <Input id="search" label="Check someone in" placeholder="Name, phone or member code" value={typed("Tony", t, 2700, 8)} focus={t >= 2500 && t < 4000} right={<Search className="size-4" />} />
                {t >= 3200 && t < 4050 && (
                  <div className="d-rise mt-2 flex items-center gap-3 rounded-xl bg-canvas px-3 py-2 text-sm">
                    <Avatar>TA</Avatar>
                    <span className="flex-1">
                      <span className="block font-medium">Tony Azar</span>
                      <span className="block text-xs text-muted">10 visits · 4 left</span>
                    </span>
                    <Btn id="ci" className="h-9">
                      Check in
                    </Btn>
                  </div>
                )}
              </Card>
              <Card>
                <SectionTitle>Today</SectionTitle>
                <ul className="divide-y divide-line border-t border-line">
                  {rows
                    .filter(([at]) => t >= at)
                    .map(([at, time, name, ok, why]) => (
                      <li key={name} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${at ? "d-rise" : ""}`}>
                        <span className="w-12 shrink-0 text-xs text-muted tabular-nums">{time}</span>
                        <span className="min-w-0 flex-1 font-medium">
                          {name}
                          {why && <span className="block text-xs font-normal text-muted">{why}</span>}
                        </span>
                        {ok ? <Badge tone="green">In</Badge> : <Badge tone="red">Denied</Badge>}
                      </li>
                    ))}
                </ul>
              </Card>
              <Toast t={t} at={4050}>
                Tony Azar checked in
              </Toast>
            </Page>
          );
        },
      },
      {
        title: "Your gym today",
        who: "Owner",
        what: "The Overview is your morning check: active members, check-ins today, memberships ending in the next 7 days, money collected this month and money owed, plus the latest check-ins. Tap any number to see the list behind it.",
        start: ["Overview, the first page after you log in."],
        page: "Overview",
        end: 3400,
        scene: (t) => (
          <Page title="Overview" description="Your gym today.">
            <Tiles t={t} items={[["Active members", 412], ["Check-ins today", 126], ["Expiring in 7 days", 18], ["Collected this month", 6240, true], ["Owed by members", 195, true, true]]} />
            <div className="grid gap-4 @xl:grid-cols-2">
              <Card>
                <SectionTitle>Memberships ending this week</SectionTitle>
                <ul className="divide-y divide-line border-t border-line">
                  {[
                    ["Rami Haddad", "2 days", "red"],
                    ["Lara Nassar", "4 days", "amber"],
                  ].map(([n, b, tone]) => (
                    <li key={n} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span className="font-medium">{n}</span>
                      <Badge tone={tone as "red" | "amber"}>{b}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <SectionTitle>Latest check-ins</SectionTitle>
                <ul className="divide-y divide-line border-t border-line">
                  {[
                    ["08:12", "Nour Khalil", true],
                    ["08:11", "Karim Saad", false],
                  ].map(([time, n, ok]) => (
                    <li key={String(n)} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="w-12 text-xs text-muted tabular-nums">{time}</span>
                      <span className="flex-1 font-medium">{n}</span>
                      {ok ? <Badge tone="green">In</Badge> : <Badge tone="red">Denied</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Page>
        ),
      },
    ],
  },
  {
    name: "Schedule and classes",
    steps: [
      {
        title: "The calendar",
        who: "Owner, manager, trainers",
        what: "Every class, personal-training session and monthly course on a day, week or month calendar. On phones it becomes a simple list. Quick add puts a class on the calendar in seconds, and it repeats every week. Trainers only see their own classes.",
        start: ["Schedule → Quick add."],
        page: "Schedule",
        taps: [
          { at: 1500, id: "qa" },
          { at: 3700, id: "ok" },
        ],
        end: 5200,
        scene: (t) => {
          const events: [number, number, string, string, boolean?][] = [
            [0, 7, "Spinning", "Ziad"],
            [0, 18, "Pilates", "Maya"],
            [1, 17, "PT · Nour", "Ziad"],
            [2, 19, "Boxing", "Ziad"],
            [3, 18, "Pilates", "Maya"],
            [5, 10, "Kids boxing", "Ziad"],
            ...(t >= 3900 ? ([[4, 19, "HIIT", "Ziad", true]] as [number, number, string, string, boolean][]) : []),
          ];
          const days = ["Mon 3", "Tue 4", "Wed 5", "Thu 6", "Fri 7", "Sat 8", "Sun 9"];
          return (
            <Page
              title="Schedule"
              description="Classes, monthly courses and personal training, on a calendar or as a list."
              action={
                <Btn id="qa">
                  <Plus className="size-4" /> Quick add
                </Btn>
              }
            >
              <div className="w-60">
                <Tabs items={["Day", "Week", "Month"]} active="Week" />
              </div>
              <Card className="hidden overflow-hidden @xl:block">
                <div className="grid grid-cols-7 border-b border-line text-center text-xs">
                  {days.map((d, k) => (
                    <span key={d} className={`py-2 ${k === 2 ? "font-semibold text-ink" : "text-muted"}`}>
                      {d}
                    </span>
                  ))}
                </div>
                <div className="relative grid h-64 grid-cols-7 divide-x divide-line">
                  {days.map((d, k) => (
                    <div key={d} className="relative">
                      {events
                        .filter(([dd]) => dd === k)
                        .map(([, h, name, who, fresh]) => (
                          <div
                            key={name + h}
                            className={`absolute inset-x-1 rounded-md border-l-2 border-brand-strong bg-brand/25 px-1.5 py-1 text-[11px] leading-tight ${fresh ? "d-pop ring-2 ring-brand-strong" : ""}`}
                            style={{ top: `${((h - 6) / 15) * 100}%` }}
                          >
                            <span className="block font-semibold">{name}</span>
                            <span className="text-muted">
                              {h}:00 · {who}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </Card>
              <div className="space-y-2 @xl:hidden">
                {events
                  .slice()
                  .sort((a, b) => a[0] - b[0] || a[1] - b[1])
                  .map(([d, h, name, who, fresh]) => (
                    <Card key={name + d + h} className={`flex items-center gap-3 p-3 text-sm ${fresh ? "d-pop border-brand-strong" : ""}`}>
                      <span className="w-14 text-xs text-muted">{days[d]}</span>
                      <span className="flex-1 font-medium">{name}</span>
                      <span className="text-xs text-muted">
                        {h}:00 · {who}
                      </span>
                    </Card>
                  ))}
              </div>
              <Dialog t={t} at={1700} until={3900} title="Quick add">
                <Input label="Class" value={typed("HIIT", t, 1900, 8)} focus={t < 2600} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Day" value="Friday" />
                  <Input label="Starts at" value="19:00" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Trainer" value="Ziad Khoury" />
                  <Input label="Spots" value="14" />
                </div>
                <div className="flex justify-end gap-2">
                  <Btn variant="secondary">Cancel</Btn>
                  <Btn id="ok">Add class</Btn>
                </div>
              </Dialog>
              <Toast t={t} at={3950}>
                HIIT added every Friday at 19:00
              </Toast>
            </Page>
          );
        },
      },
      {
        title: "Bookings and waitlists",
        who: "Members",
        what: "Members book classes from their app and see how many spots are left. When a class is full they join the waitlist and move up automatically if someone cancels. Your trainers always know exactly who's coming.",
        start: ["Schedule → set the number of spots on each class."],
        tab: "Schedule",
        taps: [
          { at: 1300, id: "book" },
          { at: 2900, id: "wl" },
        ],
        end: 4800,
        scene: (t) => {
          const cls = (name: string, time: string, who: string, spots: number, cap: number, state: "open" | "full" | "booked" | "wait", id?: string) => (
            <Card key={name} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-muted">{time}</p>
                  <p className="text-xs text-muted">{who}</p>
                </div>
                {state === "booked" && (
                  <span className="d-pop">
                    <Badge tone="green">Booked</Badge>
                  </span>
                )}
                {state === "wait" && (
                  <span className="d-pop">
                    <Badge tone="amber">Waitlist · #3</Badge>
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(spots / cap) * 100}%` }} />
                </div>
                <span className="text-xs text-muted tabular-nums">
                  {spots}/{cap}
                </span>
                {state === "open" && (
                  <Btn id={id} className="h-9">
                    Book
                  </Btn>
                )}
                {state === "full" && (
                  <Btn id={id} variant="secondary" className="h-9">
                    Join waitlist
                  </Btn>
                )}
                {(state === "booked" || state === "wait") && (
                  <Btn variant="secondary" className="h-9">
                    Cancel
                  </Btn>
                )}
              </div>
            </Card>
          );
          return (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, k) => (
                  <span key={k} className={`rounded-xl py-2 text-xs ${k === 2 ? "bg-ink font-semibold text-white" : "bg-surface text-muted ring-1 ring-line"}`}>
                    {d}
                    <span className="block text-sm font-semibold">{3 + k}</span>
                  </span>
                ))}
              </div>
              {cls("Pilates", "18:00 · 60 min", "Maya · Studio", t >= 1400 ? 9 : 8, 10, t >= 1400 ? "booked" : "open", "book")}
              {cls("Boxing", "19:00 · 60 min", "Ziad · Ring", 12, 12, t >= 3000 ? "wait" : "full", "wl")}
              {cls("Spinning", "20:00 · 45 min", "Ziad · Bike room", 5, 12, "open")}
              <Toast t={t} at={1450} dur={1300} phone>
                Booked. See you at 18:00.
              </Toast>
              <Toast t={t} at={3050} phone>
                On the waitlist. We&apos;ll tell you if a spot opens.
              </Toast>
            </div>
          );
        },
      },
      {
        title: "Personal training",
        who: "Trainers",
        what: "Members request a personal-training session from their app. The trainer confirms it, and it lands on the trainer's calendar and in the member's app with a reminder, so nobody forgets.",
        start: ["Schedule → PT requests → Confirm."],
        page: "Schedule",
        taps: [{ at: 1500, id: "ok" }],
        end: 3600,
        scene: (t) => (
          <Page title="Schedule" description="Classes, monthly courses and personal training, on a calendar or as a list.">
            <Card>
              <SectionTitle>PT requests</SectionTitle>
              <div className="border-t border-line">
                {t < 1700 ? (
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <Avatar lime>NK</Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Nour Khalil</span>
                      <span className="block text-xs text-muted">Thu 6 Nov, 17:00 · with Ziad Khoury · “Upper body, please”</span>
                    </span>
                    <Btn variant="secondary" className="h-9">
                      Decline
                    </Btn>
                    <Btn id="ok" className="h-9">
                      Confirm
                    </Btn>
                  </div>
                ) : (
                  <p className="d-rise px-5 py-4 text-sm text-muted">No requests waiting.</p>
                )}
              </div>
            </Card>
            <Card>
              <SectionTitle>Upcoming PT sessions</SectionTitle>
              <ul className="divide-y divide-line border-t border-line">
                {t >= 1700 && (
                  <li className="d-rise flex items-center gap-3 bg-brand/15 px-5 py-2.5 text-sm">
                    <span className="flex-1">
                      <span className="block font-medium">Nour Khalil</span>
                      <span className="block text-xs text-muted">Thu 6 Nov, 17:00 · Ziad Khoury</span>
                    </span>
                    <Badge tone="green">Confirmed</Badge>
                  </li>
                )}
                <li className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="flex-1">
                    <span className="block font-medium">Rami Haddad</span>
                    <span className="block text-xs text-muted">Fri 7 Nov, 08:00 · Ziad Khoury</span>
                  </span>
                  <Badge tone="green">Confirmed</Badge>
                </li>
              </ul>
            </Card>
            <Toast t={t} at={1750}>
              Session confirmed. Nour gets a notification.
            </Toast>
          </Page>
        ),
      },
      {
        title: "Monthly courses",
        who: "Owner or manager",
        what: "Run courses like Pilates, Zumba, boxing or yoga with their own monthly price and number of spots. Members subscribe for the month, the course shows in their schedule, and you see who's in.",
        start: ["Schedule → New course → set the price per month and the spots."],
        page: "Schedule",
        taps: [
          { at: 900, id: "new" },
          { at: 3400, id: "ok" },
        ],
        end: 4900,
        scene: (t) => (
          <Page
            title="Schedule"
            description="Classes, monthly courses and personal training, on a calendar or as a list."
            action={
              <Btn id="new">
                <Plus className="size-4" /> New course
              </Btn>
            }
          >
            <Card>
              <SectionTitle>Monthly courses</SectionTitle>
              <ul className="divide-y divide-line border-t border-line">
                {[
                  ...(t >= 3600 ? ([["Yoga", "$40 / month · Mon & Wed 19:00", 0, 15, true]] as [string, string, number, number, boolean][]) : []),
                  ["Pilates reformer", "$60 / month · Tue & Thu 18:00", 9, 12, false] as [string, string, number, number, boolean],
                  ["Kids boxing", "$40 / month · Sat 10:00", 6, 8, false] as [string, string, number, number, boolean],
                  ["Zumba", "$35 / month · Fri 18:00", 14, 20, false] as [string, string, number, number, boolean],
                ].map(([n, d, s, c, fresh]) => (
                  <li key={n} className={`flex items-center gap-4 px-5 py-3 text-sm ${fresh ? "d-rise bg-brand/15" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{n}</span>
                      <span className="block text-xs text-muted">{d}</span>
                    </span>
                    <span className="w-24">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-canvas">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${(s / c) * 100}%` }} />
                      </span>
                      <span className="mt-1 block text-right text-xs text-muted">
                        {s} of {c}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Dialog t={t} at={1100} until={3600} title="New monthly course">
              <Input label="Class" value={typed("Yoga", t, 1300, 8)} focus={t < 2100} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Price per month (USD)" value={typed("40", t, 2300, 6)} focus={t >= 2100} />
                <Input label="Spots" value="15" />
              </div>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary">Cancel</Btn>
                <Btn id="ok">Create course</Btn>
              </div>
            </Dialog>
            <Toast t={t} at={3650}>
              Yoga created. Members can subscribe in the app.
            </Toast>
          </Page>
        ),
      },
    ],
  },
  {
    name: "Training and nutrition",
    steps: [
      {
        title: "Machines that teach",
        who: "Owner · stick once",
        what: "Gymix makes a QR code or NFC sticker for every machine. When a member scans it, a sheet slides up showing how to use the machine, with a moving demonstration and the weights they used on it last time. Fewer questions for your trainers, fewer injuries.",
        start: ["Equipment → Stickers & QR codes → print them, or write them onto NFC stickers."],
        taps: [{ at: 800, id: "scan" }],
        end: 5400,
        scene: (t) => (
          <div className="absolute inset-0 flex flex-col bg-canvas pt-12">
            <MemberHeader />
            <div className="flex-1 space-y-4 px-4 pt-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
                <p className="text-sm text-muted">How to use each machine</p>
              </div>
              <Card>
                <ul className="divide-y divide-line">
                  {["Leg press", "Lat pulldown", "Chest press", "Cable crossover"].map((m) => (
                    <li key={m} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <ExerciseAnimation paths={m === "Leg press" ? ["Leg_Press/0.jpg", "Leg_Press/1.jpg"] : null} name={m} className="size-10" />
                      <span className="flex-1 font-medium">{m}</span>
                      <ChevronRight className="size-4 text-muted" />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <BottomNav active="More" />
            {t >= 1000 && t < 2300 && (
              <div className="d-fade absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black text-white">
                <div className="relative grid size-64 place-items-center rounded-3xl border-2 border-white/80">
                  <span className="grid size-44 place-items-center rounded-2xl bg-white p-3 text-ink">
                    <QrCode className="size-full" strokeWidth={1.25} />
                  </span>
                  <span className="scan-line absolute inset-x-4 h-0.5 rounded-full bg-brand shadow-[0_0_12px_rgba(200,241,53,0.9)]" />
                </div>
                <p className="text-sm text-white/80">Scanning the sticker on the leg press</p>
              </div>
            )}
            {t >= 2300 && (
              <div className="d-fade absolute inset-0 z-30 flex items-end bg-ink/40">
                <div className="d-sheet w-full rounded-t-3xl bg-surface p-5 pb-10">
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
                  <ExerciseAnimation paths={["Leg_Press/0.jpg", "Leg_Press/1.jpg"]} name="Leg press" className="h-48 w-full rounded-2xl" />
                  <h2 className="mt-4 text-xl font-semibold">Leg press</h2>
                  <p className="text-sm text-muted">Quadriceps · glutes · hamstrings</p>
                  <p className="mt-3 inline-flex rounded-full bg-brand px-3 py-1 text-sm font-semibold">Last time: 80 kg × 10</p>
                  <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted">
                    <li>Sit with your back flat against the pad.</li>
                    <li>Feet shoulder-width apart on the platform.</li>
                    <li>Push through your heels. Don&apos;t lock your knees.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Programs from your trainers",
        who: "Trainers",
        what: "A member asks for a program in the app and says their goal. The request lands with your trainers, who build it day by day from exercises for your equipment, each with its own demonstration. It appears in the member's app straight away, ready to start.",
        start: ["Programs → Requests → Build program."],
        page: "Programs",
        taps: [
          { at: 800, id: "build" },
          { at: 2300, id: "pick" },
          { at: 4200, id: "send" },
        ],
        end: 5800,
        scene: (t) =>
          t < 1100 ? (
            <Page title="Programs" description="Answer members' requests, and build programs and templates.">
              <Tabs items={["Requests", "Build programs"]} active="Requests" badges={{ Requests: 1 }} />
              <Card>
                <SectionTitle>Requests from members</SectionTitle>
                <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 text-sm">
                  <Avatar lime>NK</Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Nour Khalil</span>
                    <span className="block text-xs text-muted">Build muscle · 4 days a week · 2 h ago</span>
                  </span>
                  <Btn id="build" className="h-9">
                    Build program
                  </Btn>
                </div>
              </Card>
            </Page>
          ) : (
            <div className="page-enter space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Build muscle</h1>
                  <p className="text-sm text-muted">For Nour Khalil · 4 days a week</p>
                </div>
                <Btn id="send">
                  <Send className="size-4" /> Send to Nour
                </Btn>
              </div>
              <Tabs items={["Day A · Legs", "Day B · Push", "Day C · Pull"]} active="Day A · Legs" />
              <div className="relative">
                <Input label="Add an exercise" placeholder="Search your gym's exercises" value={typed("Leg", t, 1500, 6)} focus={t >= 1300 && t < 2350} right={<Search className="size-4" />} />
                {t >= 1900 && t < 2350 && <Dropdown items={["Leg press", "Leg extension", "Lying leg curl"]} pick="Leg press" id="pick" hl={t >= 2200} />}
              </div>
              <Card>
                <ul className="divide-y divide-line">
                  {[
                    [2350, "Leg press", "Quadriceps", "4 × 10", ["Leg_Press/0.jpg", "Leg_Press/1.jpg"]],
                    [2900, "Lying leg curl", "Hamstrings", "3 × 12", null],
                    [3300, "Standing calf raise", "Calves", "3 × 15", null],
                  ]
                    .filter(([at]) => t >= (at as number))
                    .map(([, n, m, s, p]) => (
                      <li key={n as string} className="d-rise flex items-center gap-3 px-4 py-2.5 text-sm">
                        <ExerciseAnimation paths={p as string[] | null} name={n as string} className="size-12" />
                        <span className="flex-1">
                          <span className="block font-medium">{n as string}</span>
                          <span className="block text-xs text-muted">{m as string}</span>
                        </span>
                        <span className="rounded-lg bg-canvas px-2 py-1 text-xs font-medium tabular-nums">{s as string}</span>
                      </li>
                    ))}
                </ul>
              </Card>
              <Toast t={t} at={4400}>
                Program sent to Nour&apos;s app
              </Toast>
            </div>
          ),
      },
      {
        title: "Nutrition plans",
        who: "Dietitian",
        what: "Members ask for a meal plan from their app. Your dietitian sees their details and measurements, writes the plan meal by meal with a daily target, and sends it straight to the member's app. No more PDFs lost in WhatsApp.",
        start: ["Nutrition → Requests → Build plan."],
        page: "Nutrition",
        taps: [
          { at: 800, id: "b" },
          { at: 4300, id: "s" },
        ],
        end: 5800,
        scene: (t) =>
          t < 1100 ? (
            <Page title="Nutrition" description="Answer members' nutrition requests and build their meal plans.">
              <Tabs items={["Requests", "Plans"]} active="Requests" badges={{ Requests: 1 }} />
              <Card>
                <SectionTitle>Requests from members</SectionTitle>
                <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 text-sm">
                  <Avatar lime>NK</Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Nour Khalil</span>
                    <span className="block text-xs text-muted">Lose fat · 3 meals a day · no seafood</span>
                  </span>
                  <Btn id="b" className="h-9">
                    Build plan
                  </Btn>
                </div>
              </Card>
            </Page>
          ) : (
            <div className="page-enter space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Meal plan</h1>
                  <p className="text-sm text-muted">For Nour Khalil · lose fat</p>
                </div>
                <Btn id="s">
                  <Send className="size-4" /> Send plan
                </Btn>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["Weight", "72 kg"],
                  ["Height", "168 cm"],
                  ["Body fat", "24%"],
                  ["Target", "1,900 kcal"],
                ].map(([k, v]) => (
                  <Card key={k} className="p-3">
                    <p className="text-xs text-muted">{k}</p>
                    <p className="font-semibold">{v}</p>
                  </Card>
                ))}
              </div>
              <Card className="px-5 py-2">
                {[
                  [1300, "Breakfast", "Oats with milk, 2 eggs, a banana"],
                  [2100, "Lunch", "Grilled chicken, rice, fattoush"],
                  [2900, "Snack", "Greek yogurt with almonds"],
                  [3500, "Dinner", "Lentil soup and a green salad"],
                ].map(([at, meal, food]) => (
                  <div key={meal} className="grid grid-cols-[90px_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-0">
                    <span className="font-medium">{meal}</span>
                    <span className="text-muted">
                      {typed(food as string, t, at as number, 28)}
                      {t >= (at as number) && t < (at as number) + 900 && <span className="d-caret ml-px inline-block h-4 w-px bg-ink align-middle" />}
                    </span>
                  </div>
                ))}
              </Card>
              <Toast t={t} at={4450}>
                Plan sent to Nour&apos;s app
              </Toast>
            </div>
          ),
      },
    ],
  },
  {
    name: "Talk to members",
    steps: [
      {
        title: "Chat",
        who: "Staff and members",
        what: "Members message the gym or their coach from the app, and staff reply from the dashboard. Each conversation also shows the automatic WhatsApp messages that member received, with the time and whether they were delivered. Conversations are private to the staff member and the member.",
        start: ["Messages, or Message on a member's page."],
        page: "Messages",
        taps: [{ at: 3200, id: "send" }],
        end: 5200,
        scene: (t) => (
          <Page title="Messages" description="Your conversations with members. Private to you and the member.">
            <div className="grid gap-4 @xl:grid-cols-[190px_1fr]">
              <Card className="hidden @xl:block">
                <ul className="divide-y divide-line">
                  {[
                    ["Nour Khalil", "Can I move my session…", t < 600],
                    ["Rami Haddad", "Thanks coach!", false],
                    ["Lara Nassar", "See you tomorrow", false],
                  ].map(([n, last, unread]) => (
                    <li key={n as string} className={`flex items-center gap-2 px-3 py-2.5 text-sm ${n === "Nour Khalil" ? "bg-canvas" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{n as string}</span>
                        <span className="block truncate text-xs text-muted">{last as string}</span>
                      </span>
                      {unread && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold">1</span>}
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="flex flex-col rounded-xl border border-line bg-surface">
                <div className="border-b border-line px-4 py-3 text-sm font-semibold">Nour Khalil</div>
                <div className="min-h-64 space-y-2 p-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-[#25D366]/40 bg-[#25D366]/10 px-3.5 py-2 text-sm">
                      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-[#128C7E] uppercase">WhatsApp · automatic</p>
                      <p>Hi Nour, Iron House received your payment of $45. Thank you!</p>
                      <p className="mt-0.5 text-[10px] text-muted">Delivered · 09:12</p>
                    </div>
                  </div>
                  <At t={t} at={300} className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas px-3.5 py-2 text-sm">
                      <p>Can I move my PT session to Friday?</p>
                      <p className="mt-0.5 text-[10px] text-muted">10:03</p>
                    </div>
                  </At>
                  <At t={t} at={3300} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2 text-sm text-white">
                      <p>Sure, Friday at 17:00 works.</p>
                      <p className="mt-0.5 text-[10px] text-white/60">10:04</p>
                    </div>
                  </At>
                  <At t={t} at={4300} className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas px-3.5 py-2 text-sm">
                      <p>Perfect, thanks!</p>
                      <p className="mt-0.5 text-[10px] text-muted">10:05</p>
                    </div>
                  </At>
                </div>
                <div className="flex gap-2 border-t border-line p-3">
                  <div className={`${inputClass} flex items-center ${t >= 1000 && t < 3200 ? "border-ink ring-4 ring-brand/40" : ""}`}>
                    <span className={t >= 1100 && t < 3300 ? "" : "text-muted/70"}>{t >= 1100 && t < 3300 ? typed("Sure, Friday at 17:00 works.", t, 1100, 16) : "Write a message"}</span>
                  </div>
                  <Btn id="send" className="h-11 px-3">
                    <Send className="size-4" />
                  </Btn>
                </div>
              </div>
            </div>
          </Page>
        ),
      },
      {
        title: "Automatic WhatsApp",
        who: "Runs by itself",
        what: "Gymix sends three kinds of messages from its official WhatsApp number so you don't have to: a welcome with the login link for new members, a receipt every time someone pays, and a renewal reminder a few days before a membership ends. Each one is sent only once.",
        start: ["Settings → Gym → WhatsApp renewal reminder (0 turns reminders off)."],
        end: 4600,
        scene: (t) => (
          <WaChat t={t}>
            <WaDay>5 November</WaDay>
            <WaMsg t={t} at={300} time="09:41">
              Hi Nour, Iron House has set up your Gymix account. Open your portal: <span className="text-sky-700 underline">gymix.app/join/8fk2…</span>
            </WaMsg>
            <WaMsg t={t} at={1500} time="09:44">
              Hi Nour, Iron House received your payment of $45.00. Thank you!
            </WaMsg>
            <At t={t} at={2700}>
              <WaDay>2 December</WaDay>
            </At>
            <WaMsg t={t} at={2900} time="09:00">
              Hi Nour, your Monthly membership ends on 5 Dec 2026. Renew at the front desk to keep training.
            </WaMsg>
          </WaChat>
        ),
      },
      {
        title: "Notifications",
        who: "Members and staff",
        what: "The bell collects everything that matters: class reminders, training-day reminders, a new program from the trainer, a new meal plan, payments and messages. Members never miss what you send them.",
        start: ["Nothing to set up: it's automatic."],
        tab: "Home",
        bell: (t) => (t < 400 ? 0 : t < 1100 ? 1 : 2),
        taps: [{ at: 2000, id: "bell" }],
        end: 4400,
        scene: (t) => (
          <>
            <div className="space-y-4">
              <Greeting />
              <TodayCard />
              <WeekCard />
            </div>
            {t >= 2150 && (
              <div className="d-pop absolute top-[6.75rem] right-3 z-30 w-[300px] origin-top-right rounded-2xl border border-line bg-surface shadow-xl">
                <p className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</p>
                <ul className="divide-y divide-line">
                  {[
                    [CalendarDays, "Pilates starts at 18:00", "In 1 hour"],
                    [ClipboardList, "New program from Ziad Khoury", "Build muscle · 2 min ago"],
                    [Dumbbell, "It's a training day", "Day A · Legs is ready"],
                    [Receipt, "Payment received", "$45.00 · yesterday"],
                  ].map(([Icon, title, sub], k) => {
                    const I = Icon as typeof Bell;
                    return (
                      <li key={k} className="flex items-start gap-3 px-4 py-3 text-sm">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas">
                          <I className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">{title as string}</span>
                          <span className="block text-xs text-muted">{sub as string}</span>
                        </span>
                        {k < 2 && <span className="mt-1.5 ml-auto size-2 shrink-0 rounded-full bg-brand-strong" />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        ),
      },
    ],
  },
  {
    name: "The member app",
    steps: [
      {
        title: "Home",
        who: "Member",
        what: "The first screen members see: today's workout with one big Start button, their weekly goal and streak, their membership and days left, what's next (classes and sessions) and their invoices. Everything they need before training is one screen.",
        start: ["Nothing to do: every member gets it."],
        tab: "Home",
        end: 5200,
        scene: (t) => (
          <div className="stagger space-y-4" style={{ transform: `translateY(${-330 * ease((t - 2000) / 2200)}px)` }}>
            <Greeting />
            <TodayCard />
            <WeekCard t={t} />
            <MembershipCard />
            <Card>
              <SectionTitle>Next up</SectionTitle>
              <ul className="divide-y divide-line border-t border-line text-sm">
                <li className="flex items-center gap-3 px-5 py-3">
                  <CalendarDays className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Pilates</span>
                    <span className="block text-xs text-muted">Today at 18:00 · Studio</span>
                  </span>
                  <Badge tone="green">Booked</Badge>
                </li>
                <li className="flex items-center gap-3 px-5 py-3">
                  <Dumbbell className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Personal training</span>
                    <span className="block text-xs text-muted">Thu 6 Nov, 17:00</span>
                  </span>
                  <Badge tone="green">Confirmed</Badge>
                </li>
              </ul>
            </Card>
          </div>
        ),
      },
      {
        title: "Build your own program",
        who: "Member",
        what: "Members who know what they want build their own program from your gym's exercises, edit it with the pen, or delete it with the bin (after a confirmation). Or they press Ask a trainer and get one built for them.",
        start: ["Train → New program, or Ask a trainer."],
        tab: "Train",
        taps: [
          { at: 900, id: "new" },
          { at: 2600, id: "e1" },
          { at: 3100, id: "e2" },
          { at: 3800, id: "save" },
        ],
        end: 5400,
        scene: (t) => (
          <>
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
                <p className="text-sm text-muted">Your training programs</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn id="new" className="h-11 rounded-xl">
                  <Plus className="size-4" /> New program
                </Btn>
                <Btn variant="secondary" className="h-11 rounded-xl">
                  Ask a trainer
                </Btn>
              </div>
              {t >= 4000 && <ProgCard name="Arms day" meta="My own · 2 exercises" hl />}
              <ProgCard name="Build muscle" meta="From Ziad Khoury · 4 days" />
              <ProgCard name="Home abs" meta="My own · 1 day" />
            </div>
            <Dialog t={t} at={1100} until={4000} title="New program" sheet>
              <Input label="Program name" value={typed("Arms day", t, 1400, 10)} focus={t < 2400} />
              <p className="text-sm font-medium">Exercises</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {["Barbell curl", "Triceps pushdown", "Hammer curl"].map((x, k) => {
                  const on = (k === 0 && t >= 2650) || (k === 1 && t >= 3150);
                  return (
                    <li key={x} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Dumbbell className="size-4 text-muted" />
                      <span className="flex-1">{x}</span>
                      <span data-tap={k === 0 ? "e1" : k === 1 ? "e2" : undefined} className={`grid size-7 place-items-center rounded-full ${on ? "check-pop bg-brand" : "border border-line"}`}>
                        {on ? <Check className="size-4" strokeWidth={3} /> : <Plus className="size-4 text-muted" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Btn id="save" className="h-12 w-full">
                Save program
              </Btn>
            </Dialog>
            <Toast t={t} at={4050} phone>
              Program saved
            </Toast>
          </>
        ),
      },
      {
        title: "Training days",
        who: "Member",
        what: "Members pick the weekdays they train and which program day goes with each one. On those days they get a reminder, and the right workout is waiting on their home screen. Their weekly goal follows the days they chose.",
        start: ["More → Profile → Training days."],
        tab: "More",
        taps: [
          { at: 900, id: "d0" },
          { at: 1400, id: "d2" },
          { at: 1900, id: "d4" },
          { at: 3300, id: "save" },
        ],
        end: 4800,
        scene: (t) => {
          const days: [number, number, string, string][] = [
            [0, 900, "Monday", "Day A · Legs"],
            [2, 1400, "Wednesday", "Day B · Push"],
            [4, 1900, "Friday", "Day C · Pull"],
          ];
          const picked = days.filter(([, at]) => t >= at + 50);
          return (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
                <p className="text-sm text-muted">Photo, training days, notifications</p>
              </div>
              <Card className="p-5">
                <h2 className="font-semibold">Training days</h2>
                <p className="text-sm text-muted">Pick your days. You get a reminder and the right workout is waiting.</p>
                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, k) => {
                    const on = picked.some(([dk]) => dk === k);
                    return (
                      <span key={k} data-tap={`d${k}`} className={`grid h-11 place-items-center rounded-xl text-sm font-semibold transition-colors ${on ? "check-pop bg-ink text-white" : "bg-canvas text-muted"}`}>
                        {d}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-4 space-y-2">
                  {picked.map(([, , name, day]) => (
                    <div key={name} className="d-rise flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="flex items-center gap-1 text-muted">
                        {day} <ChevronDown className="size-4" />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
                  <span>Weekly goal</span>
                  <b>{picked.length} workouts</b>
                </div>
                <Btn id="save" className="mt-4 w-full">
                  Save
                </Btn>
              </Card>
              <Toast t={t} at={3450} phone>
                Training days saved
              </Toast>
            </div>
          );
        },
      },
      {
        title: "The workout logger",
        who: "Member",
        what: "During the workout members fill in the weight and reps for each set and tick it. A rest timer counts down between sets, last time's numbers are right there, and the Finish button is always on screen. Beat a previous best and Gymix celebrates a personal record.",
        start: ["Home → Start workout."],
        taps: [
          { at: 900, id: "s1" },
          { at: 2500, id: "kg2" },
          { at: 3400, id: "s2" },
          { at: 4900, id: "fin" },
        ],
        end: 6600,
        scene: (t) => {
          const rest = t >= 1000 && t < 2500 ? Math.max(0, 90 - Math.floor((t - 1000) / 1000)) : null;
          const sets: [string, string, string, string, number, string?][] = [
            ["1", "80 × 10", "80", "10", 900],
            ["2", "80 × 10", t >= 2500 ? typed("85", t, 2600, 6) : "", t >= 2900 ? "8" : "", 3400, "kg2"],
            ["3", "80 × 8", "", "", Infinity],
          ];
          return (
            <div className="absolute inset-0 flex flex-col bg-canvas pt-12">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
                <span>
                  <span className="block text-sm font-semibold">Day A · Legs</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {12 + Math.floor(t / 4000)}:{String(40 + (Math.floor(t / 1000) % 20)).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-sm text-muted">1 of 5</span>
              </div>
              <div className="flex-1 space-y-4 p-4">
                <Card className="flex items-center gap-3 p-3">
                  <ExerciseAnimation paths={["Leg_Press/0.jpg", "Leg_Press/1.jpg"]} name="Leg press" className="size-16" />
                  <div>
                    <p className="font-semibold">Leg press</p>
                    <p className="text-xs text-muted">4 × 10 · last time 80 kg × 10</p>
                  </div>
                </Card>
                <Card className="overflow-hidden">
                  <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] items-center gap-2 border-b border-line bg-canvas/60 px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
                    <span>Set</span>
                    <span>Previous</span>
                    <span>kg</span>
                    <span>Reps</span>
                    <span />
                  </div>
                  {sets.map(([n, prev, kg, reps, at, id]) => {
                    const done = t >= at;
                    return (
                      <div key={n} className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] items-center gap-2 px-3 py-2 text-sm transition-colors ${done ? "bg-success-soft" : ""}`}>
                        <span className="font-semibold">{n}</span>
                        <span className="text-muted">{prev}</span>
                        <span data-tap={id} className={`grid h-9 place-items-center rounded-lg bg-surface ring-1 ${id && t >= 2500 && t < 2900 ? "ring-2 ring-ink" : "ring-line"}`}>
                          {kg || <span className="text-muted/60">–</span>}
                        </span>
                        <span className="grid h-9 place-items-center rounded-lg bg-surface ring-1 ring-line">{reps || <span className="text-muted/60">–</span>}</span>
                        <span data-tap={`s${n}`} className={`grid size-9 place-items-center rounded-full ${done ? "check-pop bg-success text-white" : "bg-canvas text-muted"}`}>
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                      </div>
                    );
                  })}
                </Card>
                {t >= 3550 && t < 5100 && (
                  <div className="pr-banner relative rounded-2xl bg-brand p-4 text-ink">
                    <span aria-hidden className="confetti pointer-events-none absolute inset-0 overflow-visible">
                      {Array.from({ length: 16 }, (_, k) => (
                        <i
                          key={k}
                          style={
                            {
                              background: ["#0d1117", "#1f7a3f", "#ffffff", "#a9d10f"][k % 4],
                              "--x": `${Math.cos((k / 16) * Math.PI * 2) * (90 + (k % 3) * 30)}px`,
                              "--y": `${Math.sin((k / 16) * Math.PI * 2) * (60 + (k % 4) * 15) - 30}px`,
                              "--r": `${(k % 2 ? 1 : -1) * (180 + k * 20)}deg`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </span>
                    <p className="flex items-center gap-2 text-lg font-bold">
                      <Trophy className="size-5" /> New personal record
                    </p>
                    <p className="text-sm">Leg press · 85 kg × 8</p>
                  </div>
                )}
              </div>
              {rest !== null && (
                <div className="d-rise mx-4 mb-3 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
                  <span className="text-sm text-white/70">Rest</span>
                  <span className="text-xl font-bold tabular-nums">
                    {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
                  </span>
                </div>
              )}
              <div className="border-t border-line bg-surface p-4 pb-8">
                <span data-tap="fin" className="flex h-14 w-full items-center justify-center rounded-2xl bg-ink text-base font-bold text-white">
                  Finish workout
                </span>
              </div>
              {t >= 5100 && (
                <div className="d-pop absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
                  <span className="grid size-20 place-items-center rounded-full bg-brand">
                    <Trophy className="size-9" />
                  </span>
                  <p className="text-3xl font-bold">Workout done</p>
                  <p className="text-muted">Day A · Legs · 1 personal record</p>
                  <div className="mt-4 grid w-full grid-cols-3 gap-2">
                    {[
                      ["Time", "14 min"],
                      ["Sets", "2"],
                      ["Volume", "1,480 kg"],
                    ].map(([k, v]) => (
                      <Card key={k} className="p-3">
                        <p className="text-xs text-muted">{k}</p>
                        <p className="font-semibold">{v}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Progress",
        who: "Member",
        what: "Members track their body measurements (weight, waist and more) and see their lifting progress over time, exercise by exercise. Seeing the results is what keeps people coming back.",
        start: ["Progress → Add measurement."],
        tab: "Progress",
        taps: [
          { at: 2400, id: "add" },
          { at: 4100, id: "save" },
        ],
        end: 5600,
        scene: (t) => {
          const w = [78, 77.2, 76.1, 75.3, 74.2, 73.1, 72, ...(t >= 4300 ? [71.5] : [])];
          const pts = w.map((v, k) => `${(k / 7) * 280 + 10},${((79 - v) / 8) * 100 + 10}`).join(" ");
          return (
            <>
              <div className="space-y-4">
                <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
                <Card className="p-5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-muted">Body weight</p>
                    <p key={w.length} className={`text-2xl font-semibold tabular-nums ${t >= 4300 ? "d-pop" : ""}`}>
                      {w[w.length - 1].toFixed(1)} kg
                    </p>
                  </div>
                  <svg viewBox="0 0 300 120" className="mt-3 h-32 w-full overflow-visible">
                    <polyline points={pts} fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ease(t / 1600)} />
                    {w.map((v, k) => (
                      <circle key={k} cx={(k / 7) * 280 + 10} cy={((79 - v) / 8) * 100 + 10} r={k === w.length - 1 ? 5 : 3} className={k === w.length - 1 ? "fill-brand-strong" : "fill-ink"} opacity={t >= (k / 7) * 1600 ? 1 : 0} />
                    ))}
                  </svg>
                  <p className="text-sm font-medium text-success">−{(78 - w[w.length - 1]).toFixed(1)} kg since August</p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-muted">Leg press · best set</p>
                  <div className="mt-3 flex h-20 items-end gap-2">
                    {[60, 65, 70, 72.5, 75, 80, 85].map((v, k) => (
                      <div key={k} className={`flex-1 rounded-t-md ${k === 6 ? "bg-brand" : "bg-ink/80"}`} style={{ height: `${(v / 85) * 100 * ease((t - 300 - k * 80) / 600)}%` }} />
                    ))}
                  </div>
                </Card>
                <Btn id="add" variant="secondary" className="h-11 w-full rounded-xl">
                  <Plus className="size-4" /> Add measurement
                </Btn>
              </div>
              <Dialog t={t} at={2600} until={4300} title="Add measurement" sheet>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Weight (kg)" value={typed("71.5", t, 2900, 6)} focus />
                  <Input label="Waist (cm)" value="78" />
                </div>
                <Btn id="save" className="h-12 w-full">
                  Save
                </Btn>
              </Dialog>
              <Toast t={t} at={4350} phone>
                Measurement saved
              </Toast>
            </>
          );
        },
      },
      {
        title: "Members pause themselves",
        who: "Member",
        what: "Travelling or injured? Members pause their own membership from Home and resume it when they're back. While it's paused they can't check in, and the paused days are added to the end date automatically. No calls to the front desk.",
        start: ["Nothing to set up: the Pause button is on the member's Home."],
        tab: "Home",
        taps: [
          { at: 900, id: "pause" },
          { at: 2200, id: "ok" },
          { at: 4000, id: "res" },
        ],
        end: 5800,
        scene: (t) => {
          const paused = t >= 2300 && t < 4100;
          const back = t >= 4100;
          return (
            <>
              <div className="space-y-4">
                <Greeting />
                <LockWrap locked={paused}>
                  <TodayCard />
                </LockWrap>
                <MembershipCard
                  badge={paused ? <Badge tone="blue">Frozen</Badge> : <Badge tone="green">Active</Badge>}
                  until={
                    <span key={back ? "b" : "a"} className={back ? "d-pop inline-block text-success" : ""}>
                      {back ? "19 Dec 2026" : "5 Dec 2026"}
                    </span>
                  }
                  left=""
                  footer={
                    paused ? (
                      <>
                        <p className="text-sm text-muted">Your membership is paused.</p>
                        <Btn id="res" className="h-9">
                          Resume
                        </Btn>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted">Away for a while? Pause it and the days are added back.</p>
                        <Btn id="pause" variant="secondary" className="h-9">
                          Pause
                        </Btn>
                      </>
                    )
                  }
                />
              </div>
              <Dialog t={t} at={1100} until={2300} title="Pause your membership?" description="You can't check in or use the app until you resume it. The paused days are added to your end date.">
                <div className="flex justify-end gap-2">
                  <Btn variant="secondary">Cancel</Btn>
                  <Btn id="ok">Pause</Btn>
                </div>
              </Dialog>
              <Later t={t} at={3000} until={4200}>
                Two weeks later
              </Later>
              <Toast t={t} at={2350} dur={1300} phone>
                Membership paused
              </Toast>
              <Toast t={t} at={4150} phone>
                Welcome back. 14 days added.
              </Toast>
            </>
          );
        },
      },
      {
        title: "Locked until they renew",
        who: "Runs by itself",
        what: "With no active membership (none, ended, paused or visits used up) or an unpaid balance, the app only opens Home. The training parts are greyed out with a lock, and the other tabs are locked too. It's a gentle, constant reason to renew.",
        start: ["Nothing to set up: it's automatic."],
        tab: "Home",
        locked: true,
        end: 3200,
        scene: () => (
          <div className="stagger space-y-4">
            <Greeting />
            <LockWrap locked>
              <TodayCard />
            </LockWrap>
            <LockWrap locked={false}>
              <MembershipCard badge={<Badge tone="red">Expired</Badge>} until="1 Nov 2026" left="" footer={<p className="text-sm text-muted">Renew at the front desk to keep training.</p>} />
            </LockWrap>
            <div className="pointer-events-none opacity-40 blur-[1.5px] grayscale">
              <WeekCard />
            </div>
          </div>
        ),
      },
      {
        title: "Shake to open programs",
        who: "Member · just for fun",
        what: "Members shake their phone three times quickly and a lime wave opens their programs. It's fast, it's fun, and it's the kind of thing they show their friends. On iPhone the app asks for motion access the first time.",
        start: ["Nothing to set up: every member can try it."],
        tab: "Home",
        device: (t) => (t >= 500 && t < 1700 ? `rotate(${Math.sin((t - 500) / 40) * 7 * (1 - (t - 500) / 1200)}deg)` : ""),
        end: 4400,
        scene: (t) => {
          const r = 80 * ease((t - 1800) / 500);
          const fade = 1 - clamp((t - 2700) / 400);
          return (
            <>
              {t < 2300 ? (
                <div className="space-y-4">
                  <Greeting />
                  <TodayCard />
                  <WeekCard />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
                    <p className="text-sm text-muted">Your training programs</p>
                  </div>
                  <ProgCard name="Build muscle" meta="From Ziad Khoury · 4 days" />
                  <ProgCard name="Home abs" meta="My own · 1 day" />
                </div>
              )}
              <Later t={t} at={200} until={1700}>
                Shake, shake, shake
              </Later>
              {t >= 1800 && t < 3100 && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-brand text-ink" style={{ clipPath: `circle(${r}% at 50% 55%)`, opacity: fade }}>
                  <span className="flex flex-col items-center gap-2 text-2xl font-bold" style={{ transform: `scale(${0.6 + 0.4 * ease((t - 1950) / 400)})`, opacity: clamp((t - 1900) / 250) }}>
                    <Dumbbell className="size-10" />
                    My programs
                  </span>
                </div>
              )}
            </>
          );
        },
      },
      {
        title: "The dropped-phone joke",
        who: "Member · just for fun",
        what: "If a member drops their phone, the screen flashes, cracks, heals itself, and a joke pops up. Members can also try it safely from Profile → Try it. Little surprises like this are why members talk about the app.",
        start: ["Profile → Try it."],
        tab: "Home",
        device: (t) => {
          if (t < 300 || t >= 1000) return "";
          const p = ease((t - 300) / 600);
          return `translateY(${p * 46}px) rotate(${p * -9}deg)`;
        },
        end: 5000,
        scene: (t) => (
          <>
            <div className="space-y-4">
              <Greeting />
              <TodayCard />
              <WeekCard />
            </div>
            {t >= 900 && t < 5000 && (
              <div className="drop-scene absolute inset-0 z-40">
                <div className="drop-flash absolute inset-0 bg-white" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="drop-glass absolute inset-0 size-full" aria-hidden>
                  <circle cx="48" cy="42" r="1.6" className="fill-white/80" />
                  {CRACKS.map((d, k) => (
                    <path key={k} d={d} pathLength={1} vectorEffect="non-scaling-stroke" className="drop-crack" style={{ animationDelay: `${(k % 6) * 40}ms` }} />
                  ))}
                </svg>
                <div className="absolute inset-x-6 bottom-[7.5rem] grid place-items-center">
                  <div className="drop-card max-w-sm rounded-3xl bg-ink px-6 py-5 text-center text-white shadow-2xl">
                    <p className="text-2xl font-bold tracking-tight">That&apos;s not a deadlift.</p>
                    <p className="mt-1 text-sm text-white/70">Relax, the screen is fine. That was us.</p>
                    <p className="mt-3 inline-block rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-ink">Back to it</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ),
      },
    ],
  },
  {
    name: "Your Gymix account",
    steps: [
      {
        title: "Your subscription",
        who: "Owner",
        what: "Gymix is $19.99 a month for the whole gym after a 14-day free trial: unlimited members, staff and features. Pay by Whish Money, OMT or bank transfer, for one month or several at once. If it ends you get a few days' grace, then the staff dashboard locks until you renew. Your data is never deleted, and members keep their app meanwhile.",
        start: ["Settings → Subscription: your status, how to pay, and your payments."],
        page: "Settings",
        end: 3200,
        scene: (t) => (
          <Page title="Settings">
            <Tabs items={SETTINGS_TABS} active="Subscription" />
            <div className="grid gap-4 @xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Gymix subscription</h2>
                  <Badge tone="green">Active</Badge>
                </div>
                <p className="mt-3 text-3xl font-semibold">
                  $19.99<span className="text-base font-normal text-muted"> / month</span>
                </p>
                <p className="text-sm text-muted">Paid until 5 Feb 2027</p>
                <p className="mt-4 text-sm font-medium">Everything included</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {PLAN_FEATURES.slice(0, 4).map((f, k) => (
                    <At key={f} t={t} at={300 + k * 150} className="flex items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {f}
                    </At>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold">How to pay</h2>
                <p className="mt-1 text-sm text-muted">One month or several at once. Send us the receipt and we record it.</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {["Whish Money", "OMT", "Bank transfer"].map((m) => (
                    <li key={m} className="rounded-xl bg-canvas px-3 py-2.5 font-medium">
                      {m}
                    </li>
                  ))}
                </ul>
                <Btn variant="whatsapp" className="mt-4 w-full">
                  <MessageCircle className="size-4" /> Message Gymix on WhatsApp
                </Btn>
              </Card>
            </div>
            <Card>
              <SectionTitle>Payments to Gymix</SectionTitle>
              <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-sm">
                <span>
                  5 Nov 2026<span className="block text-xs text-muted">3 months · Whish Money</span>
                </span>
                <span className="font-medium">$59.97</span>
              </div>
            </Card>
          </Page>
        ),
      },
      {
        title: "Help when you need it",
        who: "Gymix support",
        what: "Stuck? Message Gymix and our support team can open your dashboard and fix things with you, right where you are. Nothing to install and no screen sharing.",
        start: ["Settings → Subscription → Message Gymix on WhatsApp."],
        page: "Plans",
        cursor: "Gymix support",
        taps: [
          { at: 900, id: "edit" },
          { at: 2800, id: "save" },
        ],
        end: 4400,
        scene: (t) => {
          const editing = t >= 1000 && t < 2900;
          const name = t < 1300 ? "Montly" : t < 1700 ? "Montly".slice(0, Math.max(4, 6 - Math.floor((t - 1300) / 150))) : "Mont" + typed("hly", t, 1800, 8);
          return (
            <Page title="Membership plans" description="What you sell at the front desk. Prices are in USD.">
              <Table head={["Plan", "Price", ""]}>
                <tr className={editing ? "bg-brand/15" : ""}>
                  <td className="px-4 py-3 font-medium">
                    {editing ? (
                      <span className={`${inputClass} flex h-9 w-44 items-center border-ink ring-4 ring-brand/40`}>
                        {name}
                        <span className="d-caret ml-px h-4 w-px bg-ink" />
                      </span>
                    ) : (
                      <span className={t < 1000 ? "underline decoration-danger decoration-wavy underline-offset-4" : ""}>{t < 1000 ? "Montly" : "Monthly"}</span>
                    )}
                  </td>
                  <Td>$45</Td>
                  <td className="w-14 px-4 py-3">
                    {editing ? (
                      <span data-tap="save" className="grid size-8 place-items-center rounded-lg bg-ink text-white">
                        <Check className="size-4" />
                      </span>
                    ) : (
                      <span data-tap="edit" className="grid size-8 place-items-center rounded-lg text-muted">
                        <Pencil className="size-4" />
                      </span>
                    )}
                  </td>
                </tr>
                {[
                  ["3 months", "$120"],
                  ["Yearly", "$420"],
                ].map(([a, b]) => (
                  <tr key={a}>
                    <Td b>{a}</Td>
                    <Td>{b}</Td>
                    <td />
                  </tr>
                ))}
              </Table>
              <Toast t={t} at={2950}>
                Plan saved
              </Toast>
            </Page>
          );
        },
      },
      {
        title: "Your data is private",
        who: "Everyone",
        what: "Each gym's data is kept apart in the database itself, not just hidden on the screen. Trainers don't see money, members only see their own records, and the Gymix team only sees totals, never your members' details.",
        start: ["Nothing to set up: it's built in."],
        page: "Team",
        end: 2600,
        scene: () => (
          <Page title="Team" description="Your managers, front desk and trainers. Members are on the Members page.">
            <Card>
              <SectionTitle>What each role sees</SectionTitle>
              <ul className="stagger divide-y divide-line border-t border-line">
                {[
                  ["Owner", "Everything, including the subscription"],
                  ["Manager", "Running the gym: members, money, schedule, team"],
                  ["Front desk", "Members, check-in and payments"],
                  ["Trainer", "Their classes, clients and programs. No money."],
                  ["Dietitian", "Nutrition requests and meal plans. No money."],
                  ["Member", "Only their own records"],
                ].map(([r, d]) => (
                  <li key={r} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-24 shrink-0">
                      <Badge tone="gray">{r}</Badge>
                    </span>
                    <span className="text-muted">{d}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="flex items-center gap-3 p-4 text-sm">
              <ShieldCheck className="size-5 shrink-0 text-success" />
              Each gym&apos;s data is kept apart in the database itself.
            </Card>
          </Page>
        ),
      },
    ],
  },
];

// ---------------------------------------------------------------- devices
function Scaled({ w, h, max, children }: { w: number; h: number; max: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(max / w);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setS(el.clientWidth / w);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [w]);
  // overflow-hidden: the device keeps its full size for layout, only its picture is scaled.
  return (
    <div ref={box} className="mx-auto w-full overflow-hidden" style={{ maxWidth: max, height: h * s }}>
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

function Laptop({ page, active, screen, overlay, children }: { page: NavKey; active: NavKey; screen: RefObject<HTMLDivElement | null>; overlay: ReactNode; children: ReactNode }) {
  return (
    <Scaled w={988} h={644} max={860}>
      <div className="rounded-[18px] bg-[#1b1f24] p-[14px] shadow-2xl ring-1 ring-black/40">
        <div ref={screen} className="relative h-[600px] w-[960px] overflow-hidden rounded-[5px] bg-canvas" data-page={page}>
          <div className="flex h-full">
            <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
                <Logo />
                <Bell className="size-[18px] text-muted" />
              </div>
              <div className="px-3 pt-3">
                <div className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2">
                  <span className="grid size-8 place-items-center rounded-md bg-ink text-xs font-semibold text-brand">IH</span>
                  <span>
                    <span className="block text-sm font-semibold">Iron House</span>
                    <span className="block text-xs text-muted">Your gym</span>
                  </span>
                </div>
              </div>
              <ul className="space-y-0.5 px-3 py-3">
                {NAV.map(([label, Icon]) => {
                  const on = label === active;
                  return (
                    <li key={label} data-tap={`nav-${label}`} className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200 ${on ? "bg-ink font-medium text-white" : "text-ink/80"}`}>
                      <Icon className={`size-[18px] ${on ? "text-brand" : "text-muted"}`} />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </aside>
            {/* Not positioned: dialogs and toasts cover the whole screen, as in the app. */}
            <main className="min-w-0 flex-1 overflow-hidden px-8 py-7 @container">{children}</main>
          </div>
          {overlay}
        </div>
      </div>
      <div className="relative h-4 rounded-b-[14px] bg-gradient-to-b from-[#d5d8dc] to-[#9da1a8]">
        <span className="absolute top-0 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-b-lg bg-[#8b9097]" />
      </div>
    </Scaled>
  );
}

function Phone({ screen, overlay, dark, header, bottom, full, transform, children }: { screen: RefObject<HTMLDivElement | null>; overlay: ReactNode; dark?: boolean; header?: ReactNode; bottom?: ReactNode; full?: boolean; transform?: string; children: ReactNode }) {
  return (
    <Scaled w={414} h={844} max={340}>
      <div className="rounded-[56px] bg-[#1b1f24] p-3 shadow-2xl ring-1 ring-black/50" style={{ transform, transition: transform ? "none" : "transform 300ms" }}>
        <div ref={screen} className="relative flex h-[820px] w-[390px] flex-col overflow-hidden rounded-[44px] bg-canvas @container">
          <div className={`absolute inset-x-0 top-0 z-50 flex h-12 items-end justify-between px-8 pb-1.5 text-[15px] font-semibold ${dark ? "text-white" : "text-ink"}`}>
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <Signal className="size-4" />
              <Wifi className="size-4" />
              <BatteryFull className="size-5" />
            </span>
          </div>
          <span className="absolute top-2.5 left-1/2 z-50 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black" />
          {full ? (
            <div className="relative flex-1">{children}</div>
          ) : (
            <>
              <div className="h-12 shrink-0 bg-surface" />
              {header}
              <div className="min-h-0 flex-1 overflow-hidden px-4 pt-5">{children}</div>
              {bottom}
            </>
          )}
          <span className={`absolute bottom-2 left-1/2 z-50 h-[5px] w-32 -translate-x-1/2 rounded-full ${dark ? "bg-white/80" : "bg-ink/80"}`} />
          {overlay}
        </div>
      </div>
    </Scaled>
  );
}

// ---------------------------------------------------------------- cursor, finger and ripple
const MOVE = 650;

function PointerLayer({ t, taps, mouse, label, screen }: { t: number; taps: Tap[]; mouse: boolean; label?: string; screen: RefObject<HTMLDivElement | null> }) {
  const ptr = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const seen = useRef<Record<string, { x: number; y: number }>>({});

  useLayoutEffect(() => {
    const s = screen.current;
    const p = ptr.current;
    const r = ring.current;
    if (!s || !p || !r) return;
    const box = s.getBoundingClientRect();
    const scale = box.width / s.offsetWidth || 1;

    // Where each target is now (remembered once it disappears), and press it.
    for (const tap of taps) {
      const el = s.querySelector<HTMLElement>(`[data-tap="${tap.id}"]`);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      seen.current[tap.id] = { x: (b.left - box.left + b.width / 2) / scale, y: (b.top - box.top + b.height / 2) / scale };
      const d = t - tap.at;
      if (d > -MOVE && d < 400) {
        el.style.transition = "transform 120ms ease-out";
        el.style.transform = d >= 0 && d < 150 ? "scale(0.95)" : "";
      }
    }

    const home = { x: s.offsetWidth * 0.72, y: s.offsetHeight * 0.84 };
    let pos = home;
    let prev = home;
    let next: Tap | undefined;
    for (const tap of taps) {
      const target = seen.current[tap.id] ?? prev;
      if (t < tap.at) {
        const k = ease((t - (tap.at - MOVE)) / MOVE);
        pos = { x: prev.x + (target.x - prev.x) * k, y: prev.y + (target.y - prev.y) * k };
        next = tap;
        break;
      }
      prev = target;
      pos = target;
    }

    const last = [...taps].reverse().find((tap) => t >= tap.at);
    const since = last ? t - last.at : Infinity;
    if (mouse) {
      p.style.opacity = "1";
      p.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${since < 150 ? 0.85 : 1})`;
    } else {
      // A finger only shows around a tap: it comes down, presses and lifts.
      const near = next && t >= next.at - 450 ? next : since < 350 ? last : undefined;
      if (near) {
        const at = seen.current[near.id] ?? pos;
        const d = t - near.at;
        const o = d < 0 ? clamp((d + 450) / 300) : 1 - clamp(d / 350);
        const sc = d < 0 ? 1.3 - 0.3 * ease((d + 450) / 450) : 0.9;
        p.style.opacity = String(o);
        p.style.transform = `translate(${at.x}px, ${at.y}px) scale(${sc})`;
      } else p.style.opacity = "0";
    }

    if (last && since < 700) {
      const at = seen.current[last.id] ?? pos;
      const k = since / 700;
      r.style.opacity = String(0.9 * (1 - k));
      r.style.transform = `translate(${at.x}px, ${at.y}px) scale(${0.2 + 1.2 * ease(k)})`;
    } else r.style.opacity = "0";
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      <div ref={ring} className="absolute top-0 left-0 -mt-9 -ml-9 size-[72px] rounded-full border-2 border-brand-strong bg-brand/30 opacity-0" />
      <div ref={ptr} className="absolute top-0 left-0 opacity-0">
        {mouse ? (
          <span className="relative -mt-0.5 -ml-[3px] block">
            <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
              <path d="M3 2 L3 21 L8 16.4 L11.4 24 L14.6 22.6 L11.3 15.2 L18 15.2 Z" fill="#0d1117" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            {label && <span className="absolute top-5 left-4 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink shadow">{label}</span>}
          </span>
        ) : (
          <span className="-mt-[22px] -ml-[22px] block size-11 rounded-full bg-ink/20 ring-2 ring-white/90 backdrop-blur-[1px]" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the player
const ALL = CHAPTERS.flatMap((c, ci) => c.steps.map((s) => ({ ...s, chapter: c.name, ci })));
const readMs = (s: Step) => Math.min(14000, Math.max(7000, s.what.split(" ").length * 190));
const durationOf = (s: Step, laptop: boolean) => {
  const offset = s.page ? (laptop ? 900 : 250) : 0;
  return Math.max(readMs(s), offset + s.end + 1500);
};
const TOTAL_MIN = Math.round(ALL.reduce((sum, s) => sum + durationOf(s, true), 0) / 60000);

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function Skeletons() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-52 rounded-md bg-line/70" />
      <div className="skeleton h-24 rounded-xl bg-line/70" />
      <div className="skeleton h-64 rounded-xl bg-line/70" />
    </div>
  );
}

export function DemoTour() {
  // /demo?feature=12 opens the tour on that feature (1-based), for sharing.
  // Adding &at=3000 freezes it 3 seconds in, for screenshots.
  const params = useSearchParams();
  const asked = Number(params.get("feature")) - 1;
  const frozenAt = params.has("at") ? Math.max(0, Number(params.get("at")) || 0) : null;
  const [i, setI] = useState(() => (Number.isInteger(asked) && asked >= 0 && asked < ALL.length ? asked : 0));
  const [t, setT] = useState(frozenAt ?? 0);
  const [playing, setPlaying] = useState(frozenAt === null);
  const elapsed = useRef(frozenAt ?? 0);
  const top = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const wide = useMedia("(min-width: 1024px)");
  const reduce = useMedia("(prefers-reduced-motion: reduce)");

  const step = ALL[i];
  const laptop = Boolean(step.page) && wide;
  const offset = step.page ? (laptop ? 900 : 250) : 0;
  const dur = durationOf(step, laptop);

  const go = (n: number) => {
    elapsed.current = 0;
    setT(0);
    setI((n + ALL.length) % ALL.length);
  };

  // The clock: runs while playing, moves to the next feature at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(100, now - prev);
      prev = now;
      if (elapsed.current >= dur) {
        elapsed.current = 0;
        setT(0);
        setI((n) => (n + 1) % ALL.length);
        return;
      }
      setT(elapsed.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, playing, dur]);

  // With reduced motion every scene shows its finished state, without a pointer.
  const shown = reduce ? 1e9 : t;
  const local = shown - offset;
  const taps: Tap[] = [...(laptop ? [{ at: 450, id: `nav-${step.page}` }] : []), ...(step.taps ?? []).map((x) => ({ at: x.at + offset, id: x.id }))];
  const overlay = reduce ? null : <PointerLayer key={`${i}${laptop}`} t={t} taps={taps} mouse={laptop} label={step.cursor} screen={screen} />;
  const content = step.page && local < 0 ? <Skeletons /> : step.scene(Math.max(0, local));
  const left = Math.max(1, Math.round(ALL.slice(i).reduce((sum, s) => sum + durationOf(s, wide), 0) / 60000));

  return (
    <section className="overflow-x-clip px-4 py-10">
      <style>{CSS}</style>
      <div ref={top} className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 lg:sticky lg:top-20">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted">
            {step.page ? (
              <>
                <Monitor className="size-4" /> Staff dashboard · {wide ? "computer" : "phone"}
              </>
            ) : (
              <>
                <Smartphone className="size-4" /> Member app · iPhone and Android
              </>
            )}
          </p>
          <div key={laptop ? "laptop" : "phone"} className="d-device">
            {laptop ? (
              <Laptop page={step.page!} active={shown >= 450 ? step.page! : step.page === "Overview" ? "Members" : "Overview"} screen={screen} overlay={overlay}>
                <div key={i} className="contents">
                  {content}
                </div>
              </Laptop>
            ) : (
              <Phone
                screen={screen}
                overlay={overlay}
                dark={step.dark}
                full={!step.page && !step.tab}
                transform={step.device && !reduce ? step.device(t) : undefined}
                header={
                  step.page ? (
                    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
                      <Menu className="size-5" />
                      <Logo />
                      <Bell className="ml-auto size-5 text-muted" />
                    </div>
                  ) : (
                    <MemberHeader bell={step.bell ? step.bell(shown) : 0} />
                  )
                }
                bottom={step.page ? null : <BottomNav key={i} active={step.tab} locked={step.locked} />}
              >
                <div key={i} className="contents">
                  {content}
                </div>
              </Phone>
            )}
          </div>
          <div className="mx-auto mt-4 h-1 max-w-[320px] overflow-hidden rounded-full bg-line">
            <div className="h-full bg-brand-strong" style={{ width: `${clamp(t / dur) * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button aria-label="Previous feature" onClick={() => go(i - 1)} className="grid size-10 place-items-center rounded-xl bg-surface ring-1 ring-line hover:bg-canvas">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => setPlaying((p) => !p)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? "Pause" : "Play"}
            </button>
            <button aria-label="Next feature" onClick={() => go(i + 1)} className="grid size-10 place-items-center rounded-xl bg-surface ring-1 ring-line hover:bg-canvas">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Feature {i + 1} of {ALL.length} · about {left} min left
          </p>
        </div>

        <div className="space-y-6">
          <div key={`t${i}`} className="d-rise rounded-3xl border border-brand-strong bg-surface p-6 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-strong">
              {step.chapter} · {step.who}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{step.title}</h2>
            <p className="mt-3 leading-relaxed text-muted">{step.what}</p>
            <div className="mt-4 rounded-2xl bg-canvas p-4 text-sm">
              <p className="font-semibold">How to start</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {step.start.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            {step.tip && (
              <p className="mt-3 rounded-2xl bg-brand/30 p-4 text-sm">
                <b>Tip:</b> {step.tip}
              </p>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="All features" className="mx-auto mt-12 max-w-6xl space-y-5">
        <p className="text-sm text-muted">The whole tour takes about {TOTAL_MIN} minutes. Jump to any feature:</p>
        {CHAPTERS.map((c, ci) => (
          <div key={c.name}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{c.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL.map((s, n) =>
                s.ci !== ci ? null : (
                  <button
                    key={s.title}
                    onClick={() => {
                      go(n);
                      setPlaying(true);
                      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${n === i ? "bg-ink font-semibold text-white" : "bg-surface ring-1 ring-line hover:bg-canvas"}`}
                  >
                    {s.title}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </section>
  );
}

// The app's own keyframes (gx-rise, gx-pop, sheet-up…) live in globals.css; these classes run them once.
const CSS = `
.d-rise{animation:gx-rise 360ms cubic-bezier(.22,1,.36,1) both}
.d-pop{animation:gx-pop 220ms cubic-bezier(.22,1,.36,1) both}
.d-fade{animation:sheet-fade 220ms ease-out both}
.d-sheet{animation:sheet-up 340ms cubic-bezier(.22,1,.36,1) both}
.d-drop{animation:d-drop 420ms cubic-bezier(.22,1,.36,1) both}
@keyframes d-drop{from{transform:translateY(-140%)}to{transform:none}}
.d-device{animation:gx-pop 420ms cubic-bezier(.22,1,.36,1) both}
.d-caret{animation:d-blink 1s steps(1) infinite}
@keyframes d-blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.d-rise,.d-pop,.d-fade,.d-sheet,.d-drop,.d-device,.d-caret{animation:none}}
`;
