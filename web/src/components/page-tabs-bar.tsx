"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

// The tab in the address bar, if it is one of `ids`; otherwise `fallback`.
function useTabParam(ids: readonly string[], fallback: string) {
  const value = useSearchParams().get("tab");
  return value && ids.includes(value) ? value : fallback;
}

// In-page tabs. Each tab is a ?tab= link on the same page (so the choice
// survives a refresh and the back button), never a different page.
// With `instant`, every panel is already on the page (see TabPanel): a click
// just shows another one and updates the address, with no server round trip.
// Without it, the click loads the tab from the server; the white pill moves
// right away either way.
export function PageTabs({
  tabs,
  active,
  base,
  instant = false,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  // Path of the page, plus any query to keep (e.g. "/dashboard/programs").
  base: string;
  instant?: boolean;
}) {
  const [pending, setPending] = useState<{ id: string; from: string } | null>(null);
  const fromUrl = useTabParam(
    tabs.map((t) => t.id),
    active,
  );
  // A click is only "pending" until the page reports a different tab.
  const current = instant ? fromUrl : pending && pending.from === active ? pending.id : active;

  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const el = tabRefs.current.get(current);
    if (!list || !el) return;
    const place = () => setPill({ left: el.offsetLeft, width: el.offsetWidth });
    place();
    // Keep the chosen tab in view when the bar scrolls sideways on phones.
    const l = el.offsetLeft - list.scrollLeft;
    if (l < 0 || l + el.offsetWidth > list.clientWidth) {
      list.scrollTo({ left: el.offsetLeft - 16, behavior: animate ? "smooth" : "auto" });
    }
    const ro = new ResizeObserver(place);
    ro.observe(list);
    ro.observe(el);
    // Only slide after the first placement, never on page load.
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [current, animate]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className="relative flex gap-1 overflow-x-auto rounded-2xl bg-line/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {pill && (
        <span
          aria-hidden
          className={`absolute top-1 bottom-1 rounded-xl bg-surface shadow-[0_1px_2px_rgba(13,17,23,0.08),0_2px_8px_rgba(13,17,23,0.06)] ring-1 ring-ink/5 ${
            animate ? "transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" : ""
          }`}
          style={{ left: pill.left, width: pill.width }}
        >
          <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-brand-strong" />
        </span>
      )}
      {tabs.map((t) => {
        const on = t.id === current;
        const sep = base.includes("?") ? "&" : "?";
        return (
          <Link
            key={t.id}
            ref={(el) => {
              if (el) tabRefs.current.set(t.id, el);
              else tabRefs.current.delete(t.id);
            }}
            role="tab"
            aria-selected={on}
            href={`${base}${sep}tab=${t.id}`}
            scroll={false}
            replace
            onClick={(e) => {
              if (t.id === current) return;
              if (instant && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                const url = new URL(window.location.href);
                url.searchParams.set("tab", t.id);
                window.history.replaceState(null, "", url);
                return;
              }
              setPending({ id: t.id, from: active });
            }}
            className={`relative z-10 flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm sm:px-4 whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              on ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"
            } ${on && !pill ? "bg-surface shadow-sm" : ""}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-none font-bold tabular-nums transition-colors ${
                  on ? "bg-brand text-ink" : "bg-surface/80 text-ink ring-1 ring-ink/10"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// One tab's content. Every panel is rendered with the page; only the one
// matching ?tab= is shown, so switching is instant and nothing reloads.
// `display: contents` keeps grid and spacing layouts exactly as before.
export function TabPanel({ id, tabs, children }: { id: string; tabs: readonly string[]; children: React.ReactNode }) {
  const current = useTabParam(tabs, tabs[0]);
  return (
    <div className={current === id ? "contents" : "hidden"} role="tabpanel" aria-hidden={current !== id || undefined}>
      {children}
    </div>
  );
}
