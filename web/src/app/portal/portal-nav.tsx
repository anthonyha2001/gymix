"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Grid2x2,
  House,
  Lock,
  MessageCircle,
  Play,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Modal } from "@/components/dialog";
import type { PortalPage } from "@/lib/portal-pages";

type Tab = { href: string; label: string; icon: typeof House; page?: PortalPage };

// Five tabs; everything else lives under "More".
const MAIN: Tab[] = [
  { href: "/portal", label: "Home", icon: House },
  { href: "/portal/train", label: "Train", icon: Play, page: "train" },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarDays, page: "schedule" },
  { href: "/portal/progress", label: "Progress", icon: TrendingUp, page: "progress" },
];
const MORE: (Tab & { hint: string })[] = [
  { href: "/portal/programs", label: "Programs", icon: ClipboardList, page: "programs", hint: "Your training programs" },
  { href: "/portal/machines", label: "Machines", icon: Dumbbell, page: "machines", hint: "How to use each machine" },
  { href: "/portal/messages", label: "Chat", icon: MessageCircle, page: "messages", hint: "Talk to your trainer" },
  { href: "/portal/profile", label: "Profile", icon: UserRound, hint: "Photo, training days, notifications" },
];

const isActive = (pathname: string, href: string) => (href === "/portal" ? pathname === href : pathname.startsWith(href));

// Bottom tab bar, fixed to the foot of the screen and clear of the iPhone's
// home indicator.
export function PortalNav({ unread = 0, hidden = [], frozen = false }: { unread?: number; hidden?: PortalPage[]; frozen?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const shown = (t: Tab) => !t.page || !hidden.includes(t.page);
  const tabs = MAIN.filter(shown);
  const more = MORE.filter(shown);
  const moreActive = more.some((t) => isActive(pathname, t.href));

  const tabClass = (active: boolean, locked = false) =>
    `relative flex min-w-0 flex-col items-center justify-center gap-1 ${locked ? "cursor-not-allowed text-muted/50" : active ? "text-ink" : "text-muted hover:text-ink"}`;
  const iconWrap = (active: boolean) => `grid h-8 w-12 place-items-center rounded-full transition-colors duration-200 ${active ? "nav-bounce bg-brand" : ""}`;
  const label = "w-full truncate text-center text-[11px] font-medium leading-none";

  return (
    <nav data-bottom-bar aria-label="Portal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur">
      <div className="mx-auto grid h-[4.25rem] max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          if (frozen && t.page) {
            return (
              <span key={t.href} aria-disabled="true" title="Locked until your balance is paid" className={tabClass(false, true)}>
                <span className="relative grid h-8 w-12 place-items-center">
                  <Icon className="size-5" strokeWidth={1.75} />
                  <Lock className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-surface p-px text-muted" strokeWidth={2.5} />
                </span>
                <span className={label}>{t.label}</span>
              </span>
            );
          }
          return (
            <Link key={t.href} href={t.href} prefetch aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className={iconWrap(active)}>
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={label}>{t.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
          <span className={iconWrap(moreActive)}>
            <Grid2x2 className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} />
          </span>
          <span className={label}>More</span>
          {unread > 0 && (
            <span className="absolute top-1.5 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white" aria-label={`${unread} unread`}>
              {unread}
            </span>
          )}
        </button>
      </div>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" sheet>
        <ul className="-mx-2 space-y-1">
          {more.map((t) => {
            const Icon = t.icon;
            const locked = frozen && Boolean(t.page);
            const body = (
              <>
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${isActive(pathname, t.href) ? "bg-brand" : "bg-canvas"}`}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-sm text-muted">{locked ? "Locked until your balance is paid" : t.hint}</span>
                </span>
                {t.href === "/portal/messages" && unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">{unread}</span>
                )}
                {locked ? <Lock className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
              </>
            );
            return (
              <li key={t.href}>
                {locked ? (
                  <span className="flex items-center gap-3 rounded-2xl px-2 py-2 opacity-60">{body}</span>
                ) : (
                  <Link href={t.href} prefetch onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-canvas active:scale-[0.99]">
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Modal>
    </nav>
  );
}
