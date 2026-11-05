"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Dumbbell, LayoutDashboard, Lock,
  MessageCircle, Monitor, Nfc, Pause, Play, QrCode, Salad, Settings, ShieldCheck, Smartphone, Tag, Users,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

// The full Gymix tour (about 5 minutes): every feature plays as a short animation on a phone,
// with a full explanation, who uses it, how to start and a tip. Scenes are plain HTML so they stay crisp.

type Step = {
  title: string;
  who: string;
  what: string;
  start: string[];
  tip?: string;
  scene: () => ReactNode;
};
type Chapter = { name: string; steps: Step[] };

// ---- Scene building blocks (d = delay in tenths of a second) ----
const Row = ({ d = 0, className = "", children }: { d?: number; className?: string; children: ReactNode }) => (
  <div className={`demo-up ${className}`} style={{ animationDelay: `${d / 10}s` }}>{children}</div>
);
const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={`rounded-2xl bg-surface p-3 text-ink shadow-sm ${className}`}>{children}</div>
);
const Head = ({ children }: { children: ReactNode }) => (
  <Row><p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p></Row>
);
const Rows = ({ items, from = 3 }: { items: [string, string][]; from?: number }) => (
  <>
    {items.map(([a, b], k) => (
      <Row key={a} d={from + k * 3}>
        <Card className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{a}</span><span className="text-right text-xs text-muted">{b}</span></Card>
      </Row>
    ))}
  </>
);
const Wa = ({ d, children }: { d: number; children: ReactNode }) => (
  <Row d={d}><div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-xs text-ink"><MessageCircle className="mb-1 size-3.5 text-success" />{children}</div></Row>
);
const TONE = { ok: "bg-success text-white", bad: "bg-danger text-white", ink: "bg-ink text-white", lime: "bg-brand text-ink" } as const;
const Banner = ({ d = 0, tone, title, sub, className = "" }: { d?: number; tone: keyof typeof TONE; title: ReactNode; sub?: string; className?: string }) => (
  <Row d={d}><div className={`rounded-2xl p-3 text-center ${TONE[tone]} ${className}`}><p className="font-bold">{title}</p>{sub && <p className="text-xs opacity-80">{sub}</p>}</div></Row>
);
const Btn = ({ d, children }: { d: number; children: ReactNode }) => (
  <Row d={d}><div className="demo-press rounded-2xl bg-ink p-3 text-center text-sm font-semibold text-white" style={{ animationDelay: `${d / 10 + 0.8}s` }}>{children}</div></Row>
);
const Tiles = ({ items }: { items: [string, string][] }) => (
  <div className="grid grid-cols-2 gap-2">
    {items.map(([k, v], n) => (
      <Row key={k} d={2 + n * 2}><Card><p className="text-[11px] text-muted">{k}</p><p className="text-lg font-bold tabular-nums">{v}</p></Card></Row>
    ))}
  </div>
);

// ---- The tour ----
const CHAPTERS: Chapter[] = [
  {
    name: "Set up your gym",
    steps: [
      {
        title: "Create your gym",
        who: "Owner · 1 minute",
        what: "Sign up, name your gym and you're its owner. Everything else hangs off this: your team, members, plans and money all live inside your gym and nobody else's. You get 14 days free with every feature, no card needed.",
        start: ["Go to the website and press Start free trial.", "Confirm your email, then name your gym."],
        tip: "The Overview page shows a setup checklist. Tick it off and you're ready.",
        scene: () => (
          <>
            <Head>Set up your gym</Head>
            <Row d={3}><Card><p className="text-xs text-muted">Gym name</p><p className="demo-type font-semibold">Iron House Achrafieh</p></Card></Row>
            <Btn d={10}>Create gym</Btn>
            {["Add your equipment", "Create membership plans", "Add your first member", "Set up the check-in sticker"].map((t, n) => (
              <Row key={t} d={16 + n * 2}><Card className="flex items-center gap-2 text-xs"><span className="size-3 rounded-full border-2 border-line" />{t}</Card></Row>
            ))}
          </>
        ),
      },
      {
        title: "Your lira rate and gym rules",
        who: "Owner · 1 minute",
        what: "Prices in Gymix are in dollars. You set your own lira rate, and the front desk uses it whenever someone pays in lira. Change it whenever the market moves. Here you also decide how many days after an invoice an unpaid member gets frozen.",
        start: ["Settings → Gym: enter the lira rate and the freeze days."],
        tip: "Update the rate in the morning and the whole front desk uses the new one straight away.",
        scene: () => (
          <>
            <Head>Settings · Gym</Head>
            <Row d={3}><Card><p className="text-xs text-muted">Lira rate</p><p className="text-xl font-bold">89,500 <span className="text-sm text-muted">LBP = $1</span></p></Card></Row>
            <Row d={7}><Card><p className="text-xs text-muted">Freeze unpaid members after</p><p className="text-xl font-bold">3 days</p></Card></Row>
            <Row d={11}><Card><p className="text-xs text-muted">WhatsApp renewal reminder</p><p className="text-xl font-bold">3 days before</p></Card></Row>
            <Banner d={16} tone="ok" title="Saved ✓" />
          </>
        ),
      },
      {
        title: "Membership plans",
        who: "Owner or manager · 2 minutes",
        what: "Create every way you sell your gym: monthly, quarterly, yearly or visit packs (for example 10 visits). Each plan has a price in dollars and a length. When you sell one, Gymix calculates the end date or counts the visits and knows exactly when it runs out.",
        start: ["Plans → New plan.", "Pick monthly, yearly or visits, then set the price."],
        tip: "Make a cheap visit pack for people who just want to try. They often upgrade.",
        scene: () => (
          <>
            <Head>Plans</Head>
            <Rows items={[["Monthly", "$45 · 30 days"], ["3 months", "$120 · 90 days"], ["Yearly", "$420 · 365 days"], ["10 visits", "$30 · 10 check-ins"]]} />
            <Btn d={17}>+ New plan</Btn>
          </>
        ),
      },
      {
        title: "Your equipment",
        who: "Owner or manager · 5 minutes",
        what: "List the machines and equipment your gym really has: leg press, cables, dumbbells, bikes. Programs only use exercises for this equipment, so a trainer (or a member building their own) never gets an exercise on a machine you don't have.",
        start: ["Equipment → pick from the list or add your own."],
        tip: "Do this before your trainers start building programs.",
        scene: () => (
          <>
            <Head>Equipment</Head>
            {["Leg press", "Cable station", "Dumbbells 2-40 kg", "Smith machine", "Rowing machine"].map((e, n) => (
              <Row key={e} d={3 + n * 3}><Card className="flex items-center justify-between text-sm"><span>{e}</span><span className="demo-pop grid size-5 place-items-center rounded-full bg-brand" style={{ animationDelay: `${0.5 + n * 0.3}s` }}><Check className="size-3" strokeWidth={3} /></span></Card></Row>
            ))}
            <Banner d={20} tone="ink" title="5 machines · 64 exercises available" />
          </>
        ),
      },
      {
        title: "Invite your team",
        who: "Owner",
        what: "Invite managers, front desk, trainers and a dietitian by email. Each role sees only what it needs: trainers see their classes and clients but no money, the front desk sells memberships and takes payments, managers run almost everything. The invite is claimed as soon as that person signs up.",
        start: ["Team → Invite → email and role."],
        tip: "Owners can invite anyone. Managers can invite front desk, trainers and dietitians. The front desk can only add members.",
        scene: () => (
          <>
            <Head>Team</Head>
            <Rows items={[["Maya", "Manager"], ["Joe", "Front desk"], ["Karim", "Trainer"], ["Rita", "Dietitian"]]} />
            <Row d={16}><Card className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4 text-success" /> Trainers never see money</Card></Row>
          </>
        ),
      },
      {
        title: "Choose what members see",
        who: "Owner",
        what: "You decide which pages the member app shows: programs, nutrition, schedule, machines, chat. Don't have a dietitian? Hide nutrition. Members only see what your gym really offers.",
        start: ["Settings → Member app → switch pages on or off."],
        scene: () => (
          <>
            <Head>Settings · Member app</Head>
            {[["Programs", true], ["Schedule", true], ["Nutrition", false], ["Machines", true], ["Chat", true]].map(([n, on], k) => (
              <Row key={n as string} d={3 + k * 3}><Card className="flex items-center justify-between text-sm"><span>{n}</span><span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${on ? "justify-end bg-success" : "bg-line"}`}><span className="size-4 rounded-full bg-white" /></span></Card></Row>
            ))}
          </>
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
        what: "Type the name and phone number, and that's it. Each member gets a member code and a profile with their memberships, payments, check-ins, programs and chat in one place. Search by name, phone or code to find anyone in seconds.",
        start: ["Members → Add member."],
        tip: "Add members as they walk in. You don't need to enter everyone on day one.",
        scene: () => (
          <>
            <Head>New member</Head>
            <Row d={2}><Card><p className="text-xs text-muted">Name</p><p className="demo-type font-semibold">Nour Khalil</p></Card></Row>
            <Row d={6}><Card><p className="text-xs text-muted">Phone</p><p className="font-semibold">+961 70 123 456</p></Card></Row>
            <Btn d={10}>Add member</Btn>
            <Banner d={16} tone="ok" title="Nour added" sub="Member code GX-0412" />
          </>
        ),
      },
      {
        title: "Their app arrives on WhatsApp",
        who: "Automatic",
        what: "As soon as you add a member with a phone number, they receive a WhatsApp message from Gymix with a personal link. One tap opens their app, already logged in. No App Store, no download, no password to remember. They can add it to their home screen like any other app on iPhone or Android.",
        start: ["Nothing to do: it's sent when you add the member.", "You can also copy the link and send it yourself."],
        scene: () => (
          <>
            <Head>WhatsApp</Head>
            <Wa d={3}>Hi Nour, Iron House has set up your Gymix account. Open your portal: gymix.app/join/…</Wa>
            <Row d={12} className="flex justify-center"><span className="demo-tap text-3xl">👆</span></Row>
            <Banner d={18} tone="lime" title="Welcome to Iron House" sub="Add to home screen" />
          </>
        ),
      },
      {
        title: "Logging in later",
        who: "Member and front desk",
        what: "The first link signs them straight in, and Gymix shows them a password once. After that they log in anywhere with their phone number, email or member code plus that password. Forgot it? The front desk resets it in one click.",
        start: ["Member page → Reset password, if they ever need it."],
        scene: () => (
          <>
            <Head>Log in</Head>
            <Row d={3}><Card><p className="text-xs text-muted">Phone, email or member code</p><p className="font-semibold">GX-0412</p></Card></Row>
            <Row d={6}><Card><p className="text-xs text-muted">Password</p><p className="font-semibold">••••••••</p></Card></Row>
            <Btn d={10}>Log in</Btn>
            <Banner d={16} tone="ok" title="Hi Nour 👋" />
          </>
        ),
      },
      {
        title: "Sell a membership",
        who: "Front desk",
        what: "Pick a plan, choose the start date, and Gymix creates the membership and its invoice. You can take the payment straight away or later. The end date (or the visits left) shows in the member's app.",
        start: ["Member page → Sell membership → choose a plan."],
        scene: () => (
          <>
            <Head>Sell membership · Nour</Head>
            <Rows items={[["Plan", "Monthly · $45"], ["Starts", "Today"], ["Ends", "5 Dec"]]} />
            <Btn d={13}>Sell and take payment</Btn>
            <Banner d={19} tone="ok" title="Membership active ✓" sub="Invoice #1042 · $45" />
          </>
        ),
      },
      {
        title: "Payments in dollars and lira",
        who: "Front desk",
        what: "Record payments in cash dollars, cash lira at your rate, card, Whish or OMT. Gymix converts lira at your rate so the front desk never needs a calculator. Partial payments are fine: what's left stays on the invoice as owed.",
        start: ["Member page → Record payment, or straight from Sell membership."],
        tip: "Each payment sends the member a WhatsApp receipt automatically.",
        scene: () => (
          <>
            <Head>Record payment</Head>
            <Row d={2}><Card><p className="text-xs text-muted">Invoice</p><p className="text-2xl font-bold">$45.00</p></Card></Row>
            <Row d={5} className="grid grid-cols-5 gap-1 text-center text-[10px] font-semibold">
              {["USD", "LBP", "Card", "Whish", "OMT"].map((m) => <span key={m} className={`rounded-lg py-2 ${m === "LBP" ? "bg-brand" : "bg-surface"}`}>{m}</span>)}
            </Row>
            <Row d={9}><Card className="text-center"><p className="text-xs text-muted">Collect</p><p className="text-lg font-bold">4,027,500 LBP</p></Card></Row>
            <Wa d={16}>Hi Nour, Iron House received your payment of $45. Thank you!</Wa>
          </>
        ),
      },
      {
        title: "Billing: who owes what",
        who: "Owner, manager, front desk",
        what: "One list of every unpaid invoice and every payment. See today's collection, this month's total, and who owes you and how much. Tap a name to collect. Trainers and dietitians can't see this page.",
        start: ["Billing."],
        scene: () => (
          <>
            <Head>Billing</Head>
            <Tiles items={[["Collected this month", "$6,240"], ["Owed", "$385"]]} />
            <Rows from={7} items={[["Karim Saad", "$45 · 6 days late"], ["Lea Haddad", "$120 · 2 days"], ["Tony Azar", "$30 · today"]]} />
          </>
        ),
      },
      {
        title: "Unpaid? Frozen. Automatically.",
        who: "Runs by itself",
        what: "If a member still owes money a few days after an invoice (3 by default, you choose), Gymix freezes them. Their app only shows its home page and their check-in is refused at the door with \"See the front desk\". As soon as they pay, their next check-in lets them in. No awkward conversations.",
        start: ["Settings → Gym → choose the number of days."],
        tip: "This alone usually pays for Gymix in the first month.",
        scene: () => (
          <div className="flex h-full flex-col justify-center gap-3">
            <Row><div className="demo-shake rounded-2xl bg-danger p-4 text-center text-white"><Lock className="mx-auto mb-1 size-6" /><p className="font-bold">Account frozen</p><p className="text-xs opacity-80">Unpaid $45 · see the front desk</p></div></Row>
            <Row d={14}><Card className="flex justify-between text-sm"><span>Paid $45 in lira</span><Check className="size-4 text-success" /></Card></Row>
            <Banner d={22} tone="ok" title="Checked in ✓" sub="Welcome back, Karim" />
          </div>
        ),
      },
      {
        title: "Freeze, resume and renew",
        who: "Front desk or manager",
        what: "A member got injured or is travelling? Freeze their membership, and when you resume it the frozen days are added to the end date. Renew in one tap when it ends: same plan, starting the day after the old one ends.",
        start: ["Member page → Freeze, Resume or Renew."],
        scene: () => (
          <>
            <Head>Membership · Nour</Head>
            <Row d={2}><Card><p className="text-xs text-muted">Monthly · ends</p><p className="text-lg font-bold">5 Dec</p></Card></Row>
            <Btn d={6}>Freeze</Btn>
            <Banner d={11} tone="ink" title="Frozen for 10 days" />
            <Row d={16}><Card><p className="text-xs text-muted">New end date</p><p className="text-lg font-bold text-success">15 Dec</p></Card></Row>
          </>
        ),
      },
      {
        title: "Expiring soon",
        who: "Owner, manager, front desk",
        what: "The Overview lists everyone whose membership ends in the next 7 days, so you can call them before they leave. Gymix also messages them on WhatsApp a few days before (see Automatic WhatsApp).",
        start: ["Overview → Expiring in 7 days."],
        scene: () => (
          <>
            <Head>Expiring in 7 days</Head>
            <Rows items={[["Rami Haddad", "in 2 days"], ["Lara Nassar", "in 4 days"], ["Elie Khoury", "in 6 days"]]} />
            <Btn d={13}>Message Rami</Btn>
          </>
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
        what: "Buy NFC stickers (about $1 each) and write your gym's check-in link onto one from your phone, right inside Gymix. Stick it at the entrance. Members tap their phone on it and they're checked in. No turnstile, no card reader, no hardware.",
        start: ["Settings → Check-in → Write to NFC sticker.", "Stick it at the door."],
        tip: "Put a second sticker at the front desk for busy hours.",
        scene: () => (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className="relative grid size-24 place-items-center rounded-3xl bg-ink text-brand">
              <Nfc className="size-10" /><span className="demo-ring absolute inset-0 rounded-3xl border-2 border-brand" />
            </div>
            <div className="demo-tap text-3xl">📱</div>
            <Banner d={14} className="w-full" tone="ok" title="Checked in" sub="Welcome back, Nour" />
          </div>
        ),
      },
      {
        title: "QR check-in",
        who: "Member",
        what: "Phone without NFC? Print your gym's QR code from Gymix and put it next to the sticker. Members scan it with the scanner in their app and get the same check-in. Both ways check their membership and payment before letting them in.",
        start: ["Settings → Check-in → Print QR code."],
        scene: () => (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="relative grid size-32 place-items-center overflow-hidden rounded-3xl bg-surface shadow"><QrCode className="size-20 text-ink" /><span className="demo-scan absolute inset-x-3 h-0.5 bg-brand-strong" /></div>
            <Banner d={14} className="w-full" tone="ok" title="Checked in" sub="9 visits left" />
          </div>
        ),
      },
      {
        title: "Check-in log",
        who: "Front desk and owner",
        what: "See every check-in live: who came in, when, and who was refused and why (unpaid, expired, no visits left). The front desk can also check someone in by hand.",
        start: ["Check-in."],
        scene: () => (
          <>
            <Head>Check-in · live</Head>
            <Rows items={[["Nour Khalil", "✓ 08:12"], ["Rami Haddad", "✓ 08:09"], ["Karim Saad", "✗ unpaid"], ["Lea Haddad", "✓ 08:01"]]} />
          </>
        ),
      },
      {
        title: "Your gym today",
        who: "Owner",
        what: "The Overview is your morning check: active members, check-ins today, memberships expiring in 7 days, money collected this month and money owed. Tap any number to see the list behind it.",
        start: ["Overview (the first page after logging in)."],
        scene: () => (
          <>
            <Head>Overview</Head>
            <Tiles items={[["Active members", "412"], ["Check-ins today", "126"], ["Expiring in 7 days", "18"], ["Collected", "$6,240"]]} />
            <Row d={12} className="flex h-20 items-end gap-1">
              {[38, 52, 44, 63, 58, 71, 66, 80, 74, 92].map((h, n) => <span key={n} className="demo-grow flex-1 rounded-t bg-brand-strong" style={{ height: `${h}%`, animationDelay: `${1.2 + n * 0.08}s` }} />)}
            </Row>
          </>
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
        what: "Every class, personal-training session and course on a day, week or month calendar. On phones it becomes a simple list. Quick add puts a class on the calendar in seconds. Trainers only see their own classes.",
        start: ["Schedule → Quick add."],
        scene: () => (
          <>
            <Head>Schedule · this week</Head>
            <Row d={2} className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, n) => <span key={n} className={`rounded-lg py-2 font-semibold ${n === 2 ? "bg-brand" : "bg-surface"}`}>{d}<span className="mx-auto mt-1 block size-1 rounded-full bg-ink" /></span>)}
            </Row>
            <Rows from={6} items={[["07:00 Spinning", "Karim"], ["18:00 Pilates", "Maya"], ["19:00 Boxing", "Karim"]]} />
          </>
        ),
      },
      {
        title: "Bookings and waitlists",
        who: "Members",
        what: "Members book classes from their app. Each class has a capacity: when it's full, members join the waitlist and move up when someone cancels. The trainer sees exactly who's coming.",
        start: ["Schedule → set the class capacity."],
        scene: () => (
          <>
            <Head>Book a class</Head>
            <Rows items={[["18:00 Pilates", "8/10"], ["19:00 Boxing", "Full · waitlist 2"]]} />
            <Btn d={9}>Book Pilates</Btn>
            <Banner d={15} tone="ok" title="Booked · 9/10 ✓" sub="Reminder before class" />
          </>
        ),
      },
      {
        title: "Personal training",
        who: "Trainers",
        what: "Schedule one-on-one sessions between a trainer and a member. They show up on the trainer's calendar and in the member's app, so nobody forgets.",
        start: ["Schedule → Quick add → Personal training."],
        scene: () => (
          <>
            <Head>Personal training</Head>
            <Row d={3}><Card><p className="text-xs text-muted">Thursday 17:00</p><p className="font-bold">Karim × Nour</p><p className="text-xs text-muted">Upper body · 60 min</p></Card></Row>
            <Banner d={10} tone="lime" title="In Nour's app ✓" />
          </>
        ),
      },
      {
        title: "Monthly courses",
        who: "Owner or manager",
        what: "Run courses like Pilates, Zumba, boxing or yoga with their own monthly price. Members sign up for the month and the course shows in their schedule.",
        start: ["Schedule → create a class with a monthly price."],
        scene: () => (
          <>
            <Head>Monthly courses</Head>
            <Rows items={[["Pilates reformer", "$60/month · 12 spots"], ["Kids boxing", "$40/month · 8 spots"], ["Zumba", "$35/month · 20 spots"]]} />
          </>
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
        what: "Gymix makes a QR or NFC sticker for every machine. When a member scans it, a sheet slides up with how to use the machine, an exercise demonstration and the weights they used on it last time. Fewer questions for your trainers, fewer injuries.",
        start: ["Equipment → Print stickers, or write them to NFC."],
        scene: () => (
          <>
            <Row className="flex justify-center"><div className="grid size-20 place-items-center rounded-2xl bg-ink text-brand"><QrCode className="size-10" /></div></Row>
            <Row d={8}><div className="demo-sheet rounded-t-3xl bg-surface p-4 text-ink shadow-lg"><p className="font-bold">Leg Press</p><p className="mt-1 text-xs text-muted">Feet shoulder-width, push through your heels, don&apos;t lock your knees.</p><p className="mt-3 rounded-xl bg-canvas p-2 text-sm">Last time: <b>80 kg × 10</b></p></div></Row>
          </>
        ),
      },
      {
        title: "Programs from your trainers",
        who: "Trainers",
        what: "A member asks for a program in the app and says their goal. The request lands with your trainers, who build it day by day with exercises for your equipment. It appears in the member's app straight away, ready to start.",
        start: ["Programs → Requests → Build program."],
        scene: () => (
          <>
            <Row><Card className="text-xs"><b>Nour</b> asked: <i>“Build muscle, 4 days a week”</i></Card></Row>
            {["Day A · Leg Press 4 × 10", "Day A · Lat Pulldown 3 × 12", "Day B · Chest Press 3 × 10"].map((e, n) => (
              <Row key={e} d={6 + n * 4}><Card className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-brand-strong" />{e}</Card></Row>
            ))}
            <Banner d={20} tone="ink" title="Sent to Nour's app" />
          </>
        ),
      },
      {
        title: "Nutrition plans",
        who: "Dietitian",
        what: "Your dietitian sees each member's details and measurements, writes a meal plan, and sends it straight to the member's app. No more PDFs lost in WhatsApp.",
        start: ["Nutrition → choose a member → New plan."],
        scene: () => (
          <>
            <Head>Meal plan · Nour</Head>
            <Rows items={[["Breakfast", "Oats, eggs, fruit"], ["Lunch", "Chicken, rice, salad"], ["Snack", "Greek yogurt"], ["Dinner", "Fish, vegetables"]]} />
            <Banner d={16} tone="lime" title="2,100 kcal · sent ✓" />
          </>
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
        what: "Members message the gym or their coach from the app, and staff reply from the dashboard. Each conversation also shows the automatic WhatsApp messages that member received, with the time and whether they were delivered.",
        start: ["Messages."],
        scene: () => (
          <>
            <Head>Chat · Nour</Head>
            <Row d={3}><div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-surface p-3 text-xs">Can I move my session to Friday?</div></Row>
            <Row d={9}><div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-ink p-3 text-xs text-white">Sure, Friday 17:00 works 💪</div></Row>
            <Row d={15}><Card className="text-[11px] text-muted">WhatsApp · Renewal reminder · delivered 07:00</Card></Row>
          </>
        ),
      },
      {
        title: "Automatic WhatsApp",
        who: "Runs by itself",
        what: "Gymix sends three messages from its official WhatsApp number so you don't have to: a renewal reminder a few days before a membership ends, a receipt every time someone pays, and the welcome link for new members. Each is sent only once.",
        start: ["Settings → choose the reminder days (0 turns it off)."],
        scene: () => (
          <>
            <Wa d={2}>Hi Rami, your Monthly membership ends on 7 Nov. Renew at the front desk to keep training.</Wa>
            <Wa d={9}>Hi Lara, Iron House received your payment of $45. Thank you!</Wa>
            <Wa d={16}>Hi Nour, Iron House has set up your Gymix account. Open your portal: …</Wa>
          </>
        ),
      },
      {
        title: "Notifications",
        who: "Members and staff",
        what: "A bell in the app collects everything that matters: class reminders, training-day reminders, a new program from the trainer, a meal plan, a message. Members never miss what you send.",
        start: ["Nothing to do: it's automatic."],
        scene: () => (
          <>
            <Row className="flex justify-end"><span className="demo-ring-bell relative grid size-10 place-items-center rounded-full bg-ink text-brand"><Bell className="size-5" /><span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-danger text-[9px] text-white">3</span></span></Row>
            <Rows items={[["Pilates at 18:00", "in 1 hour"], ["New program from Karim", "now"], ["Leg day today 💪", "07:30"]]} />
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
        what: "The first screen members see: today's workout, their weekly goal and streak, membership and days left, their next class, and any invoices. Everything they need before training is one screen away.",
        start: ["Nothing to do: every member gets it."],
        scene: () => (
          <>
            <Banner tone="ink" title="Monthly · 23 days left" sub="Iron House" />
            <Row d={5}><Card><p className="text-xs text-muted">Today</p><p className="font-bold">Leg day · 5 exercises</p></Card></Row>
            <Row d={9}><Card className="flex justify-between text-sm"><span>This week</span><b>2 / 4 🔥 6-week streak</b></Card></Row>
            <Row d={13}><Card className="flex justify-between text-sm"><span>Next class</span><b>Pilates 18:00</b></Card></Row>
          </>
        ),
      },
      {
        title: "Build your own program",
        who: "Member",
        what: "Members who know what they want can build their own program with your equipment, edit it with the pen icon, or delete it (with a confirmation). Or they tap Ask a trainer.",
        start: ["Train → Programs → New program."],
        scene: () => (
          <>
            <Head>Your programs</Head>
            <Rows items={[["Build muscle · 4 days", "from Karim"], ["Home abs", "my own"]]} />
            <Btn d={9}>+ New program</Btn>
            <Btn d={14}>Ask a trainer</Btn>
          </>
        ),
      },
      {
        title: "Training days",
        who: "Member",
        what: "Members pick the weekdays they train and which program day goes with each. On those days they get a reminder and the right workout is waiting on their home screen.",
        start: ["Train → Training days."],
        scene: () => (
          <>
            <Head>Training days</Head>
            <Row d={2} className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, n) => <span key={n} className={`demo-pop rounded-lg py-3 ${[0, 2, 4].includes(n) ? "bg-brand" : "bg-surface"}`} style={{ animationDelay: `${0.3 + n * 0.1}s` }}>{d}</span>)}
            </Row>
            <Rows from={9} items={[["Monday", "Day A · Legs"], ["Wednesday", "Day B · Push"], ["Friday", "Day C · Pull"]]} />
          </>
        ),
      },
      {
        title: "The workout logger",
        who: "Member",
        what: "During the workout members tick each set with the weight and reps, a rest timer counts down between sets, and the Finish button is always on screen. Beat a previous best and Gymix celebrates a personal record with confetti.",
        start: ["Home → Start today's workout."],
        scene: () => (
          <>
            <Banner tone="ink" title="Leg Press" sub="Rest 0:45" />
            {[["Set 1", "80 kg × 10"], ["Set 2", "85 kg × 8"]].map(([s, w], n) => (
              <Row key={s} d={4 + n * 5}><Card className="flex items-center justify-between text-sm"><span>{s} · {w}</span><span className="demo-pop grid size-6 place-items-center rounded-full bg-brand" style={{ animationDelay: `${0.8 + n * 0.5}s` }}><Check className="size-3.5" strokeWidth={3} /></span></Card></Row>
            ))}
            <Row d={16}><div className="relative rounded-2xl bg-brand p-3 text-center font-bold text-ink">New record! 85 kg 🎉
              {Array.from({ length: 10 }, (_, n) => <span key={n} className="demo-confetti absolute top-1/2 left-1/2 size-1.5 rounded-sm" style={{ background: n % 2 ? "#0d1117" : "#1f7a3f", ["--x" as string]: `${(n - 5) * 18}px`, animationDelay: "1.8s" }} />)}
            </div></Row>
            <Btn d={22}>Finish workout</Btn>
          </>
        ),
      },
      {
        title: "Progress",
        who: "Member",
        what: "Members track body measurements (weight, waist and more) and see their lifting progress over time. Seeing results is what keeps people coming back.",
        start: ["Progress → Add measurement."],
        scene: () => (
          <>
            <Head>Progress · weight</Head>
            <Row d={2}><Card className="flex h-32 items-end gap-1.5">
              {[90, 86, 82, 80, 77, 74, 72].map((h, n) => <span key={n} className="demo-grow flex-1 rounded-t bg-brand-strong" style={{ height: `${h}%`, animationDelay: `${0.3 + n * 0.1}s` }} />)}
            </Card></Row>
            <Banner d={12} tone="ok" title="−6 kg in 3 months" />
          </>
        ),
      },
      {
        title: "Members pause themselves",
        who: "Member",
        what: "Travelling or injured? Members pause their own membership from Home and resume it when they're back. The paused days are added to the end date automatically. No calls to the front desk.",
        start: ["Nothing to do: it's on the member's Home."],
        scene: () => (
          <div className="flex h-full flex-col justify-center gap-3">
            <Row><Card><p className="text-xs text-muted">Membership ends</p><p className="text-lg font-bold">12 Dec → <span className="text-success">26 Dec</span></p></Card></Row>
            <Btn d={6}><Pause className="mr-1 inline size-4" /> Paused 14 days</Btn>
            <Row d={12}><Card className="text-center text-xs text-muted">Resume any time from Home</Card></Row>
          </div>
        ),
      },
      {
        title: "Locked until they renew",
        who: "Runs by itself",
        what: "With no active membership (none, expired, paused or visits used up) or an unpaid balance, the app only opens Home and the training parts are greyed out with a lock. It's a gentle, constant reason to renew.",
        start: ["Nothing to do: it's automatic."],
        scene: () => (
          <>
            <Banner tone="bad" title="Membership ended" sub="Renew at the front desk" />
            {["Today's workout", "Book a class", "Programs"].map((t, n) => (
              <Row key={t} d={6 + n * 3}><Card className="flex items-center justify-between text-sm opacity-50"><span>{t}</span><Lock className="size-4" /></Card></Row>
            ))}
          </>
        ),
      },
      {
        title: "Shake to open programs",
        who: "Member · just for fun",
        what: "Members shake their phone three times quickly and a lime wave opens their programs. It's fast, it's fun, and it's the kind of thing they show their friends. On iPhone it asks for motion access on the first tap.",
        start: ["Nothing to do: every member can try it."],
        scene: () => (
          <div className="relative flex h-full flex-col items-center justify-center">
            <span className="demo-wobble text-6xl">📱</span>
            <span className="demo-wave absolute inset-0 rounded-2xl bg-brand" />
            <p className="demo-up absolute font-bold text-ink" style={{ animationDelay: "2.4s" }}>Your programs</p>
          </div>
        ),
      },
      {
        title: "The dropped-phone joke",
        who: "Member · just for fun",
        what: "If a member drops their phone, the screen \"cracks\", heals itself, and a joke pops up. Members can try it safely from Profile → Try it. Little surprises like this are why members talk about the app.",
        start: ["Profile → Try it."],
        scene: () => (
          <div className="relative flex h-full items-center justify-center">
            <svg viewBox="0 0 100 100" className="demo-crack absolute inset-0 size-full text-ink/60" fill="none" stroke="currentColor" strokeWidth="0.8">
              <path d="M50 45 L20 10 M50 45 L85 15 M50 45 L90 60 M50 45 L60 95 M50 45 L10 70 M35 28 L28 40 M70 30 L80 38" />
            </svg>
            <Row d={22}><Card className="text-center text-sm font-semibold">Relax, it&apos;s fine 😅<br /><span className="text-xs text-muted">Your gains are safe.</span></Card></Row>
          </div>
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
        what: "Gymix is $19.99 a month for the whole gym, after a 14-day free trial: unlimited members, staff and features. Pay by Whish, OMT or bank transfer, for one month or several. If it ends, you have a few days' grace, then the staff dashboard locks until you renew. Your data is never deleted, and members keep their app meanwhile.",
        start: ["Settings → Subscription: see your status and how to pay."],
        scene: () => (
          <>
            <Head>Settings · Subscription</Head>
            <Banner d={2} tone="ok" title="Active" sub="Paid until 5 Feb" />
            <Row d={6}><Card className="text-center"><p className="text-3xl font-bold">$19.99</p><p className="text-xs text-muted">a month · whole gym</p></Card></Row>
            <Row d={10} className="grid grid-cols-3 gap-1 text-center text-xs font-semibold">
              {["Whish", "OMT", "Bank"].map((m) => <span key={m} className="rounded-lg bg-surface py-2">{m}</span>)}
            </Row>
          </>
        ),
      },
      {
        title: "Help when you need it",
        who: "Gymix support",
        what: "Stuck? Message Gymix and our support can open your dashboard (a banner shows when we're in) and fix it with you. Nothing to install, no screen sharing.",
        start: ["Message Gymix on WhatsApp from Settings → Subscription."],
        scene: () => (
          <>
            <Banner tone="lime" title="Gymix support is helping you" sub="Back to normal any time" />
            <Rows from={6} items={[["Plans", "fixed ✓"], ["Lira rate", "updated ✓"]]} />
          </>
        ),
      },
      {
        title: "Your data is private",
        who: "Everyone",
        what: "Each gym's data is separated in the database itself, not just hidden on the screen. Trainers don't see money, members see only their own records, and the Gymix team only sees totals, never your members' details.",
        start: ["Nothing to do: it's built in."],
        scene: () => (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <span className="demo-pop grid size-24 place-items-center rounded-3xl bg-ink text-brand"><ShieldCheck className="size-12" /></span>
            <Banner d={8} className="w-full" tone="ok" title="Your gym. Your data." />
          </div>
        ),
      },
    ],
  },
];

// Staff features play on a laptop showing the dashboard page they live on; the rest play on the phone.
const NAV = [
  ["Overview", LayoutDashboard], ["Check-in", Nfc], ["Members", Users], ["Schedule", CalendarDays],
  ["Messages", MessageCircle], ["Programs", ClipboardList], ["Nutrition", Salad], ["Equipment", Dumbbell],
  ["Billing", CreditCard], ["Plans", Tag], ["Team", ShieldCheck], ["Settings", Settings],
] as const;
const PC_PAGE: Record<string, (typeof NAV)[number][0]> = {
  "Create your gym": "Overview", "Your lira rate and gym rules": "Settings", "Membership plans": "Plans",
  "Your equipment": "Equipment", "Invite your team": "Team", "Choose what members see": "Settings",
  "Add a member": "Members", "Sell a membership": "Members", "Payments in dollars and lira": "Members",
  "Billing: who owes what": "Billing", "Freeze, resume and renew": "Members", "Expiring soon": "Overview",
  "Check-in log": "Check-in", "Your gym today": "Overview", "The calendar": "Schedule", "Personal training": "Schedule",
  "Monthly courses": "Schedule", "Programs from your trainers": "Programs", "Nutrition plans": "Nutrition",
  Chat: "Messages", "Your subscription": "Settings", "Help when you need it": "Overview", "Your data is private": "Team",
};

function Laptop({ page, children }: { page: string; children: ReactNode }) {
  const idx = NAV.findIndex(([n]) => n === page);
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="rounded-t-2xl border-[8px] border-b-0 border-[#2a2f36] bg-[#2a2f36] shadow-2xl">
        <div className="flex h-[400px] overflow-hidden rounded-t-lg bg-canvas">
          <aside className="relative w-11 shrink-0 bg-ink p-1.5 text-white sm:w-36">
            <div className="mb-2 flex h-8 items-center gap-2 px-1">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand text-ink"><LogoMark className="size-full" /></span>
              <span className="hidden text-sm font-bold sm:inline">Gymix</span>
            </div>
            {NAV.map(([n, Icon], k) => (
              <div key={n} className={`flex h-7 items-center gap-2 rounded-lg px-2 text-[11px] ${k === idx ? "demo-hl" : "text-white/60"}`}>
                <Icon className="size-3.5 shrink-0" /><span className="hidden truncate sm:inline">{n}</span>
              </div>
            ))}
            <span className="demo-cursor pointer-events-none absolute top-0 left-0 z-10 text-lg" style={{ ["--y" as string]: `${48 + idx * 28}px` }}>🖱️</span>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-surface px-3 text-xs">
              <b>{page}</b><span className="text-muted">Iron House</span>
            </div>
            <div className="demo-page flex flex-1 flex-col gap-2 overflow-hidden p-3"><div className="mx-auto flex w-full max-w-sm flex-col gap-2">{children}</div></div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[108%] -translate-x-[3.7%] rounded-b-xl bg-gradient-to-b from-[#3a4048] to-[#1d2127]" />
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[300px] rounded-[2.5rem] border-[8px] border-[#2a2f36] bg-canvas p-3 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[#2a2f36]" />
      <div className="flex h-[376px] flex-col gap-2 overflow-hidden">{children}</div>
    </div>
  );
}

const ALL = CHAPTERS.flatMap((c, ci) => c.steps.map((s) => ({ ...s, chapter: c.name, ci, page: PC_PAGE[s.title] })));
// Long explanations stay on screen longer: about 5 minutes for the whole tour.
const msFor = (s: Step) => Math.min(13000, Math.max(7000, s.what.split(" ").length * 190));
const TOTAL_MS = ALL.reduce((t, s) => t + msFor(s), 0);

export function DemoTour() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const top = useRef<HTMLDivElement>(null);
  const step = ALL[i];
  const ms = msFor(step);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((n) => (n + 1) % ALL.length), ms);
    return () => clearTimeout(t);
  }, [i, playing, ms]);

  const go = (n: number, scroll = false) => {
    setI((n + ALL.length) % ALL.length);
    if (scroll) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const left = Math.round((ALL.slice(i).reduce((t, s) => t + msFor(s), 0)) / 60000);

  return (
    <section className="px-4 py-10">
      <style>{CSS}</style>
      <div ref={top} className="mx-auto grid max-w-6xl scroll-mt-20 items-start gap-8 lg:grid-cols-[minmax(0,640px)_1fr]">
        {/* Player: laptop for staff features, phone for member features */}
        <div className="lg:sticky lg:top-20">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted">
            {step.page ? <><Monitor className="size-4" /> Staff dashboard · computer or tablet</> : <><Smartphone className="size-4" /> Member app · iPhone and Android</>}
          </p>
          <div key={step.page ? "pc" : "phone"} className="demo-zoom">
            {step.page ? <Laptop key={i} page={step.page}>{step.scene()}</Laptop> : <Phone key={i}>{step.scene()}</Phone>}
          </div>
          <div className="mx-auto mt-3 h-1 max-w-[300px] overflow-hidden rounded-full bg-line">
            <div key={`p${i}${playing}`} className={playing ? "demo-bar h-full bg-brand-strong" : "h-full w-0"} style={{ animationDuration: `${ms}ms` }} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button aria-label="Previous" onClick={() => go(i - 1)} className="grid size-10 place-items-center rounded-xl bg-surface ring-1 ring-line"><ChevronLeft className="size-5" /></button>
            <button onClick={() => setPlaying((p) => !p)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? "Pause" : "Play"}
            </button>
            <button aria-label="Next" onClick={() => go(i + 1)} className="grid size-10 place-items-center rounded-xl bg-surface ring-1 ring-line"><ChevronRight className="size-5" /></button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">Feature {i + 1} of {ALL.length} · about {Math.max(1, left)} min left</p>
        </div>

        <div className="space-y-6">
          <div key={`t${i}`} className="demo-up rounded-3xl border border-brand-strong bg-surface p-6 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-strong">{step.chapter} · {step.who}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{step.title}</h2>
            <p className="mt-3 leading-relaxed text-muted">{step.what}</p>
            <div className="mt-4 rounded-2xl bg-canvas p-4 text-sm">
              <p className="font-semibold">How to start</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{step.start.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            {step.tip && <p className="mt-3 rounded-2xl bg-brand/30 p-4 text-sm"><b>Tip:</b> {step.tip}</p>}
          </div>

          <nav aria-label="All features" className="space-y-5">
            <p className="text-sm text-muted">The whole tour takes about {Math.round(TOTAL_MS / 60000)} minutes. Jump to any feature:</p>
            {CHAPTERS.map((c, ci) => (
              <div key={c.name}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">{c.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL.map((s, n) => s.ci !== ci ? null : (
                    <button key={s.title} onClick={() => { go(n, true); setPlaying(false); }}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${n === i ? "bg-ink font-semibold text-white" : "bg-surface ring-1 ring-line hover:bg-canvas"}`}>
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.demo-up{animation:demo-up .5s both cubic-bezier(.2,.8,.2,1)}
@keyframes demo-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.demo-type{overflow:hidden;white-space:nowrap;animation:demo-type 1s .3s steps(24) both}
@keyframes demo-type{from{max-width:0}to{max-width:100%}}
.demo-ring{animation:demo-ring 1.2s 1s ease-out 2}
@keyframes demo-ring{from{transform:scale(1);opacity:1}to{transform:scale(1.5);opacity:0}}
.demo-ring-bell{animation:demo-bell .6s .4s 2}
@keyframes demo-bell{25%{transform:rotate(-15deg)}75%{transform:rotate(15deg)}}
.demo-tap{animation:demo-tap 1.2s .2s both}
@keyframes demo-tap{0%{transform:translateY(40px);opacity:0}60%{transform:translateY(-14px);opacity:1}100%{transform:translateY(-6px)}}
.demo-shake{animation:demo-up .4s both,demo-shake .5s .5s 2}
@keyframes demo-shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.demo-pop{animation:demo-pop .4s both cubic-bezier(.3,1.6,.5,1)}
@keyframes demo-pop{from{transform:scale(0)}to{transform:scale(1)}}
.demo-press{animation:demo-press .3s 1}
@keyframes demo-press{50%{transform:scale(.94)}}
.demo-sheet{animation:demo-sheet .6s 1s both cubic-bezier(.2,.8,.2,1)}
@keyframes demo-sheet{from{transform:translateY(100%)}to{transform:none}}
.demo-confetti{animation:demo-confetti .9s both ease-out}
@keyframes demo-confetti{from{transform:translate(0,0);opacity:1}to{transform:translate(var(--x),-46px) rotate(200deg);opacity:0}}
.demo-grow{transform-origin:bottom;animation:demo-grow .5s both ease-out}
@keyframes demo-grow{from{transform:scaleY(0)}to{transform:none}}
.demo-scan{animation:demo-scan 1.4s ease-in-out 2 alternate both}
@keyframes demo-scan{from{top:12%}to{top:88%}}
.demo-wobble{animation:demo-wobble .25s .3s 6}
@keyframes demo-wobble{25%{transform:rotate(-18deg)}75%{transform:rotate(18deg)}}
.demo-wave{clip-path:circle(0% at 50% 100%);animation:demo-wave .8s 1.8s both ease-out}
@keyframes demo-wave{to{clip-path:circle(150% at 50% 100%)}}
.demo-crack{opacity:0;animation:demo-crack 2.2s .4s both}
@keyframes demo-crack{0%{opacity:0}10%,60%{opacity:1}100%{opacity:0}}
.demo-zoom{animation:demo-zoom .5s both cubic-bezier(.2,.8,.2,1)}
@keyframes demo-zoom{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
.demo-cursor{animation:demo-cursor .9s .1s both cubic-bezier(.4,0,.2,1),demo-click .2s 1s}
@keyframes demo-cursor{from{transform:translate(150px,330px);opacity:0}20%{opacity:1}to{transform:translate(22px,var(--y));opacity:1}}
@keyframes demo-click{50%{scale:.8}}
.demo-hl{color:rgba(255,255,255,.6);animation:demo-hl .3s 1s both}
@keyframes demo-hl{to{background:#c8f135;color:#0d1117;font-weight:600}}
.demo-page{animation:demo-up .4s 1s both}
.demo-bar{animation:demo-bar linear both}
@keyframes demo-bar{from{width:0}to{width:100%}}
@media (prefers-reduced-motion:reduce){[class*="demo-"]{animation:none!important;opacity:1!important;clip-path:none!important}.demo-hl{background:#c8f135;color:#0d1117}.demo-cursor{display:none}}
`;
