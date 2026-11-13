"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Activity,
  AppWindow,
  ArrowRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  Command,
  FlaskConical,
  Inbox,
  KeyRound,
  PersonStanding,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Settings2,
  UserPlus,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { openGymAsSupport } from "./actions";
import { liveNow } from "./room-actions";

type NavItem = { href: string; label: string; icon: typeof Activity; exact?: boolean; count?: "requests" | "tickets"; tag?: string };
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Now",
    items: [
      { href: "/admin", label: "Live", icon: Activity, exact: true },
      { href: "/admin/clients", label: "Clients", icon: UserPlus, count: "requests" },
      { href: "/admin/support", label: "Support", icon: Inbox, count: "tickets" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/gyms", label: "Gyms", icon: Building2 },
      { href: "/admin/revenue", label: "Revenue", icon: CircleDollarSign },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/visitors", label: "Visitors", icon: BarChart3 },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/app", label: "App & errors", icon: AppWindow },
      { href: "/admin/logins", label: "Sign-ins", icon: KeyRound },
      { href: "/admin/lab", label: "Lab", icon: FlaskConical },
      { href: "/admin/motion", label: "Motion lab", icon: PersonStanding },
      { href: "/admin/settings", label: "Settings", icon: Settings2 },
    ],
  },
];
const NAV = GROUPS.flatMap((g) => g.items);

type Counts = { requests: number; tickets: number };
type GymLite = { id: string; name: string; lab: boolean };

export function RoomShell({
  me,
  counts,
  gyms,
  signOut,
  banner,
  children,
}: {
  me: { name: string; hasGym: boolean };
  counts: Counts;
  gyms: GymLite[];
  signOut: () => Promise<void>;
  banner: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const rail = (
    <nav aria-label="Control room" className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-3 px-5 py-5" onClick={() => setOpen(false)}>
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-ink shadow-[0_0_30px_-6px_rgb(200_241_53/0.7)]">
          <LogoMark className="size-6" />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight">Gymix</span>
          <span className="block text-[10px] font-semibold tracking-[0.2em] text-brand uppercase">Control room</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setPalette(true)}
        className="mx-3 mb-3 flex h-10 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-sm text-white/45 ring-1 ring-white/[0.07] transition hover:text-white/80"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Jump to…</span>
        <kbd className="flex items-center gap-0.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold">
          <Command className="size-3" />K
        </kbd>
      </button>
      <div className="room-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g, gi) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((n, i) => {
                const active = n.exact ? path === n.href : path.startsWith(n.href);
                const c = n.count ? counts[n.count] : 0;
                return (
                  <li key={n.href} className="room-nav-in" style={{ animationDelay: `${(gi * 3 + i) * 35}ms` }}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${active ? "room-nav-active text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
                    >
                      {active && <span className="room-nav-mark absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-brand shadow-[0_0_12px_rgb(200_241_53/0.8)]" />}
                      <n.icon className={`size-[18px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${active ? "text-brand" : "group-hover:-translate-y-px group-hover:scale-110"}`} />
                      <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">{n.label}</span>
                      {n.tag && <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-200 uppercase">{n.tag}</span>}
                      <NavPending />
                      {c > 0 && <span className="room-badge grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-ink tabular-nums">{c}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <Link href={me.hasGym ? "/dashboard" : "/onboarding"} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white">
          <LayoutDashboard className="size-[18px]" /> {me.hasGym ? "My gym" : "Create a gym"}
        </Link>
        <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-bold">{me.name.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-white/70">{me.name}</span>
          <form action={signOut}>
            <button aria-label="Log out" title="Log out" className="grid size-8 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="room-rail sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-white/[0.06] bg-[#0a0d12] lg:block">{rail}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="room-fade absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="room-slide absolute inset-y-0 left-0 w-72 bg-[#0a0d12] shadow-2xl">{rail}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="room-top sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#07090d]/75 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden">
            <Menu className="size-5" />
          </button>
          <LivePill />
          <Crumb path={path} />
          <span className="flex-1" />
          <button type="button" onClick={() => setPalette(true)} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/50 ring-1 ring-white/[0.08] transition hover:text-white lg:hidden">
            <Search className="size-4" />
          </button>
          <Clock />
        </header>
        <main className="room-main mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      {palette && <Palette gyms={gyms} onClose={() => setPalette(false)} />}
    </>
  );
}

// A soft spinner on the link being opened, until the screen arrives.
function NavPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`size-3.5 rounded-full border-2 border-brand/30 border-t-brand transition-opacity duration-200 ${pending ? "animate-spin opacity-100" : "opacity-0"}`} />;
}

// The current screen's name beside the live pill.
function Crumb({ path }: { path: string }) {
  const n = [...NAV].sort((a, b) => b.href.length - a.href.length).find((x) => (x.exact ? path === x.href : path.startsWith(x.href)));
  if (!n) return null;
  return (
    <span key={n.href} className="room-crumb hidden items-center gap-2 text-sm text-white/45 sm:flex">
      <span className="text-white/15">/</span>
      <n.icon className="size-4 text-white/35" />
      <span className="font-medium text-white/80">{n.label}</span>
    </span>
  );
}

// "12 on the site now", refreshed every 15 seconds.
function LivePill() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => liveNow().then((d) => alive && setN(d?.now.length ?? 0)).catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <Link href="/admin" className="flex h-9 items-center gap-2 rounded-full bg-white/[0.04] pr-3.5 pl-3 text-sm ring-1 ring-white/[0.08] transition hover:bg-white/[0.07]">
      <span className="room-live size-2 rounded-full bg-brand" />
      <span className="font-semibold tabular-nums">{n ?? "–"}</span>
      <span className="text-white/50">on the site now</span>
    </Link>
  );
}

function Clock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" }));
    tick();
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, []);
  return <span className="hidden text-sm font-semibold tabular-nums text-white/60 sm:block">{t ? `${t} Beirut` : ""}</span>;
}

// ⌘K: every screen, and every gym (open its dashboard as support).
function Palette({ gyms, onClose }: { gyms: GymLite[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages = NAV.filter((n) => !s || n.label.toLowerCase().includes(s)).map((n) => ({ key: n.href, label: n.label, hint: "Go to", icon: n.icon, run: () => router.push(n.href) }));
    const gs = gyms
      .filter((g) => s && g.name.toLowerCase().includes(s))
      .slice(0, 8)
      .flatMap((g) => [
        { key: `g-${g.id}`, label: g.name, hint: "Gym health", icon: Building2, run: () => router.push(`/admin/gyms?gym=${g.id}`) },
        { key: `e-${g.id}`, label: `Open ${g.name} as owner`, hint: "Support", icon: ArrowRight, run: () => start(() => openGymAsSupport(g.id, "owner")) },
      ]);
    return [...pages, ...gs];
  }, [q, gyms, router]);

  const choose = (i: number) => {
    const it = items[i];
    if (!it) return;
    it.run();
    if (!it.key.startsWith("e-")) onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close" className="room-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Jump to" className="room-pop relative w-full max-w-xl overflow-hidden rounded-3xl bg-[#11161f] shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5">
          <Search className="size-5 text-white/40" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter") choose(sel);
            }}
            placeholder="Search screens and gyms…"
            className="h-14 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
          />
          {pending ? <Loader2 className="size-4 animate-spin text-brand" /> : (
            <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-white/10">
              <X className="size-4" />
            </button>
          )}
        </div>
        <ul className="max-h-[50vh] overflow-auto p-2">
          {items.map((it, i) => (
            <li key={it.key}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => choose(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${i === sel ? "bg-white/[0.08] text-white" : "text-white/70"}`}
              >
                <it.icon className={`size-4 ${i === sel ? "text-brand" : "text-white/40"}`} />
                <span className="flex-1 truncate">{it.label}</span>
                <span className="text-xs text-white/35">{it.hint}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-white/40">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}
