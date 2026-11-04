"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, CalendarDays, ClipboardList, Dumbbell, House, MessageCircle, Play, TrendingUp } from "lucide-react";
import type { PortalPage } from "@/lib/portal-pages";

const TABS: { href: string; label: string; icon: typeof House; page?: PortalPage }[] = [
  { href: "/portal", label: "Home", icon: House },
  { href: "/portal/train", label: "Train", icon: Play, page: "train" },
  { href: "/portal/programs", label: "Programs", icon: ClipboardList, page: "programs" },
  { href: "/portal/nutrition", label: "Nutrition", icon: Apple, page: "nutrition" },
  { href: "/portal/machines", label: "Machines", icon: Dumbbell, page: "machines" },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarDays, page: "schedule" },
  { href: "/portal/progress", label: "Progress", icon: TrendingUp, page: "progress" },
  { href: "/portal/messages", label: "Chat", icon: MessageCircle, page: "messages" },
];

// Bottom tab bar (icons with a short label), fixed to the foot of the screen.
export function PortalNav({ unread = 0, hidden = [] }: { unread?: number; hidden?: PortalPage[] }) {
  const pathname = usePathname();
  // Pages the gym owner switched off are left out.
  const tabs = TABS.filter((t) => !t.page || !hidden.includes(t.page));
  return (
    <nav
      data-bottom-bar
      aria-label="Portal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = t.href === "/portal" ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 ${active ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full ${active ? "bg-brand" : ""}`}>
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="w-full truncate text-center text-[9px] font-medium leading-none tracking-tight min-[400px]:text-[10px]">{t.label}</span>
              {t.href === "/portal/messages" && unread > 0 && (
                <span
                  className="absolute top-1.5 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
                  aria-label={`${unread} unread`}
                >
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
