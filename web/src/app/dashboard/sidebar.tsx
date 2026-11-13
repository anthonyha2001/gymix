"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Trophy,
  Megaphone,
  Activity,
  CalendarDays,
  ClipboardList,
  ConciergeBell,
  DoorOpen,
  Dumbbell,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Monitor,
  Receipt,
  ScanLine,
  Settings,
  ShoppingBag,
  Tags,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo, Skeleton } from "@/components/ui";
import { COMING_SOON, type NavIcon, type NavItem } from "./nav-items";

const ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  checkin: ScanLine,
  members: UserRound,
  billing: Receipt,
  plans: Tags,
  team: Users,
  settings: Settings,
  schedule: CalendarDays,
  machines: Dumbbell,
  programs: ClipboardList,
  messages: MessageCircle,
  access: DoorOpen,
  live: Activity,
  shop: ShoppingBag,
  screens: Monitor,
  reception: ConciergeBell,
  challenges: Trophy,
  announce: Megaphone,
};

// Lets nav links (rendered in a server slot) close the mobile drawer.
const CloseDrawer = createContext<() => void>(() => {});

// Fixed sidebar on desktop; slide-in drawer behind a menu button on mobile.
// `gym`, `nav` and `account` are server-rendered slots (they read the session).
export function Sidebar({ gym, nav, account, bell }: { gym: ReactNode; nav: ReactNode; account: ReactNode; bell: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Move focus into the drawer so Escape works, and back to the menu button on close.
  const openMenu = () => {
    setOpen(true);
    requestAnimationFrame(() => closeButton.current?.focus());
  };
  const close = () => {
    if (!open) return;
    setOpen(false);
    menuButton.current?.focus();
  };

  return (
    <CloseDrawer value={close}>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <button
          ref={menuButton}
          type="button"
          onClick={openMenu}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 grid size-10 place-items-center rounded-lg text-ink hover:bg-canvas"
        >
          <Menu className="size-5" />
        </button>
        <Logo />
        <div className="ml-auto">{bell}</div>
      </div>

      {/* Backdrop (mobile only) */}
      {open && <div aria-hidden className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={close} />}

      <aside
        onKeyDown={(e) => e.key === "Escape" && close()}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <Link href="/dashboard" onClick={close}>
            <Logo />
          </Link>
          <div className="hidden md:block">{bell}</div>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-2 grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="shrink-0 px-3 pt-4">{gym}</div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {nav}

          {COMING_SOON.length > 0 && (
            <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Coming soon</p>
          )}
          <ul className="space-y-1">
            {COMING_SOON.map(({ label, icon }) => {
              const Icon = ICONS[icon];
              return (
                <li
                  key={label}
                  className="flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-sm text-muted"
                  title={`${label} is coming in a later update`}
                >
                  <Icon className="size-[18px] opacity-60" />
                  <span className="flex-1 opacity-80">{label}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Soon
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line p-3">{account}</div>
      </aside>
    </CloseDrawer>
  );
}

// The active page sits on a dark pill that glides to the next link when you
// navigate; links ease in one after another on first load, and the link being
// opened shows a small spinner until its page arrives.
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const close = use(CloseDrawer);
  const list = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [glide, setGlide] = useState(false);
  const activeHref = items.find(({ href }) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href)))?.href;

  useLayoutEffect(() => {
    const el = list.current?.querySelector('[aria-current="page"]')?.closest("li");
    if (!el) {
      setPill(null);
      return;
    }
    const place = () => setPill({ top: el.offsetTop, height: el.offsetHeight });
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    const id = requestAnimationFrame(() => setGlide(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [activeHref]);

  return (
    <ul ref={list} className="relative space-y-1">
      {pill && (
        <span
          aria-hidden
          className={`owner-nav-pill absolute inset-x-0 rounded-lg bg-ink ${glide ? "transition-[top,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" : ""}`}
          style={{ top: pill.top, height: pill.height }}
        />
      )}
      {items.map(({ href, label, icon, badge }, i) => {
        const Icon = ICONS[icon];
        const active = href === activeHref;
        return (
          <li key={href} className="owner-nav-in relative" style={{ animationDelay: `${i * 28}ms` }}>
            <Link
              href={href}
              prefetch
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200 active:scale-[0.98] ${
                active ? (pill ? "font-medium text-white" : "bg-ink font-medium text-white") : "text-ink/80 hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon
                className={`size-[18px] transition-[color,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${active ? "text-brand" : "text-muted group-hover:-translate-y-px group-hover:scale-110 group-hover:text-ink"}`}
              />
              <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
              <NavPending />
              {badge !== undefined && (
                <span className="nav-bounce grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold text-ink" aria-label={`${badge} new`}>
                  {badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`size-3.5 shrink-0 rounded-full border-2 border-current/25 border-t-current transition-opacity duration-200 ${pending ? "animate-spin opacity-70" : "opacity-0"}`} />;
}

export function NavSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}
