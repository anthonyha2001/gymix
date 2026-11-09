"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Smartphone,
  X,
} from "lucide-react";
import {
  MEMBER_STOPS,
  OWNER_STOPS,
  stopIndex,
  type GuideStop,
} from "@/lib/demo-guide";
import { switchDemoRole } from "@/app/demo/actions";

// The demo's guide: a card that follows the visitor around the app and says
// what each page is for, what to try with the sample data, and where to go
// next (that menu item pulses). On phones it folds into a small pill.

const SEEN_KEY = "gx-demo-seen";
const OPEN_KEY = "gx-demo-open";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function DemoGuide({
  area,
  available,
  profileHref,
}: {
  area: "owner" | "member";
  available: string[];
  profileHref: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const welcome = useSearchParams().get("guide") === "welcome";
  const stops: GuideStop[] = (
    area === "owner" ? OWNER_STOPS : MEMBER_STOPS
  ).filter((s) =>
    s.match === "prefix" ? Boolean(profileHref) : available.includes(s.path),
  );
  const hrefOf = (s: GuideStop) =>
    s.match === "prefix" ? profileHref! : s.path;
  const index = stopIndex(stops, pathname);
  const stop = index >= 0 ? stops[index] : null;
  const next = index >= 0 ? stops[index + 1] : stops[0];
  const prev = index > 0 ? stops[index - 1] : null;

  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState<string[]>([]);
  const [showWelcome, setShowWelcome] = useState(welcome);

  // Remember what's been visited and whether the card was folded.
  useEffect(() => {
    const s = readSeen();
    let o: string | null = null;
    try {
      o = localStorage.getItem(OPEN_KEY);
    } catch {}
    const isPhone = window.matchMedia("(max-width: 767px)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read once after mount
    setOpen(welcome || (o === null ? !isPhone : o === "1"));
    if (stop && !s.includes(stop.path)) s.push(stop.path);
    setSeen(s);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch {}
  }, [stop, welcome]);

  function toggle(v: boolean) {
    setOpen(v);
    try {
      localStorage.setItem(OPEN_KEY, v ? "1" : "0");
    } catch {}
  }

  // Links to the next stop pulse: a style rule, so no other component's HTML is touched.
  const nextHref = next && !showWelcome ? hrefOf(next) : null;
  const pulse = nextHref ? (
    <style>{`a[href="${nextHref}"]:not([data-demo-guide] *){position:relative;border-radius:.6rem;animation:gx-next-pulse 1.8s ease-in-out infinite}a[href="${nextHref}"]:not([data-demo-guide] *)::after{content:"";position:absolute;top:50%;right:.6rem;width:.5rem;height:.5rem;border-radius:9999px;background:var(--color-brand-strong);transform:translateY(-50%)}@media (prefers-reduced-motion: reduce){a[href="${nextHref}"]:not([data-demo-guide] *){animation:none;box-shadow:0 0 0 3px rgb(200 241 53 / .6)}}`}</style>
  ) : null;

  const done = stops.filter((s) => seen.includes(s.path)).length;
  const pct = stops.length ? Math.round((done / stops.length) * 100) : 0;
  const position =
    area === "member"
      ? "bottom-[calc(var(--bottom-bar,4rem)+0.75rem)] right-3 left-3 sm:left-auto"
      : "bottom-4 right-4 left-4 md:left-auto";

  if (!open) {
    return (
      <>
        {pulse}
        <button
          type="button"
          data-demo-guide
          onClick={() => toggle(true)}
          className={`fixed z-40 ${area === "member" ? "bottom-[calc(var(--bottom-bar,4rem)+0.75rem)]" : "bottom-4"} right-4 flex items-center gap-2 rounded-full bg-ink py-2 pr-4 pl-2 text-sm font-medium text-white shadow-xl shadow-ink/20 transition hover:scale-[1.02]`}
        >
          <span className="grid size-7 place-items-center rounded-full bg-brand text-ink">
            <Compass className="size-4" />
          </span>
          Guide · {index >= 0 ? `${index + 1} of ${stops.length}` : "start"}
        </button>
      </>
    );
  }

  return (
    <>
      {pulse}
      <aside
        data-demo-guide
        aria-label="Demo guide"
        className={`fixed z-40 ${position} max-h-[70vh] overflow-y-auto rounded-2xl bg-ink text-white shadow-2xl shadow-ink/30 ring-1 ring-white/10 md:w-[23rem] demo-guide-in`}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5">
          <span className="grid size-7 place-items-center rounded-full bg-brand text-ink">
            <Compass className="size-4" />
          </span>
          <span className="text-xs font-semibold tracking-wide text-white/60 uppercase">
            {area === "owner" ? "Owner dashboard" : "Member app"}
            {stop && !showWelcome && ` · ${index + 1} of ${stops.length}`}
          </span>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Fold the guide"
            className="ml-auto grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <div className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {showWelcome ? (
          <div className="space-y-3 p-4">
            <p className="text-lg font-semibold">Welcome to Atlas Fitness</p>
            <p className="text-sm text-white/75">
              A sample gym with 25 members, payments, classes, a shop and three
              weeks of check-ins. It&apos;s yours for 24 hours: click anything,
              change anything. Nothing is real and no messages are sent.
            </p>
            <p className="text-sm text-white/75">
              This guide walks you through every page. Follow the pulsing menu
              item, or jump around freely.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowWelcome(false);
              toggle(true);
                router.replace(pathname);
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-ink hover:bg-brand-strong"
            >
              Start the tour <ArrowRight className="size-4" />
            </button>
          </div>
        ) : stop ? (
          <div className="space-y-3 p-4">
            <p className="text-lg leading-snug font-semibold">{stop.title}</p>
            <p className="text-sm text-white/75">{stop.body}</p>
            {stop.tryThis.length > 0 && (
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-brand uppercase">
                  Try this
                </p>
                <ul className="space-y-1.5 text-sm text-white/85">
                  {stop.tryThis.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-4">
            <p className="text-lg font-semibold">Off the guided path</p>
            <p className="text-sm text-white/75">
              Explore as you like. The next stop is waiting when you&apos;re
              ready.
            </p>
          </div>
        )}

        {!showWelcome && (
          <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
            {prev ? (
              <Link
                href={hrefOf(prev)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="size-4" /> Back
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={hrefOf(next)}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-ink hover:bg-brand-strong"
              >
                Next: {next.title} <ArrowRight className="size-4" />
              </Link>
            ) : area === "owner" ? (
              <form
                action={switchDemoRole.bind(null, "member")}
                className="ml-auto"
              >
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-ink hover:bg-brand-strong">
                  <Smartphone className="size-4" /> See the member app
                </button>
              </form>
            ) : (
              <form
                action={switchDemoRole.bind(null, "owner")}
                className="ml-auto"
              >
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-ink hover:bg-brand-strong">
                  <Check className="size-4" /> Back to the dashboard
                </button>
              </form>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Close the guide"
          className="sr-only focus:not-sr-only"
        >
          <X className="size-4" />
        </button>
      </aside>
    </>
  );
}
