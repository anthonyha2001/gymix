"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarClock, ClipboardList, MessageCircle, Apple, Dumbbell, CreditCard, BellRing, Lock, Trophy, DoorOpen } from "lucide-react";
import type { NotificationItem } from "@/lib/notifications";
import { markNotificationsRead } from "@/app/notification-actions";

const ICONS: Record<string, typeof Bell> = {
  message: MessageCircle,
  program_request: ClipboardList,
  program: ClipboardList,
  nutrition_request: Apple,
  nutrition: Apple,
  pt: Dumbbell,
  class: CalendarClock,
  course: CreditCard,
  reminder: BellRing,
  billing: Lock,
  challenge: Trophy,
  kiosk: DoorOpen,
};

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const WIDTH = 340;

// Bell with an unread count; the list opens in a panel above the page (never
// clipped by its container), like the row menus.
export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    if (pos) return setPos(null);
    const r = button.current!.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.right - WIDTH), window.innerWidth - WIDTH - 8);
    setPos({ top: r.bottom + 6, left: Math.max(8, left) });
  }

  useEffect(() => {
    if (!pos) return;
    const outside = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setPos(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    const close = () => setPos(null);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={Boolean(pos)}
        className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="fixed z-[70] flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold">Notifications</p>
              {unread > 0 && (
                <button type="button" onClick={() => startTransition(() => markNotificationsRead())} className="text-xs font-medium text-muted hover:text-ink">
                  Mark all as read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet. You&apos;ll see messages, requests and reminders here.</p>
            ) : (
              <ul className="divide-y divide-line overflow-y-auto">
                {items.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  const content = (
                    <>
                      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${n.read_at ? "bg-canvas text-muted" : "bg-brand text-ink"}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read_at ? "" : "font-semibold"}`}>{n.title}</span>
                        {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                        <span className="block text-[11px] text-muted">{ago(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-danger" />}
                    </>
                  );
                  const onOpen = () => {
                    setPos(null);
                    if (!n.read_at) startTransition(() => markNotificationsRead([n.id]));
                  };
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={onOpen} className="flex gap-3 px-4 py-3 hover:bg-canvas">
                          {content}
                        </Link>
                      ) : (
                        <button type="button" onClick={onOpen} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas">
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
