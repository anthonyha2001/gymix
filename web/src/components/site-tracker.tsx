"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Cookie } from "lucide-react";

// Gymix's own analytics, for the super admin's control room. Runs only after
// the visitor accepts analytics (the banner below); "Essential only" means
// nothing here runs. Records each visit (session), each page (time actually
// looking at it, how far down they scrolled, clicks) and clicks on buttons
// and links. Sent to /api/t in small batches.

const CONSENT_KEY = "gymix:consent"; // "full" | "basic"
const SESSION_GAP_MS = 30 * 60_000;
const IDLE_MS = 60_000;

const uuid = () => crypto.randomUUID();
const read = (k: string, store: Storage = localStorage) => {
  try {
    return store.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string, store: Storage = localStorage) => {
  try {
    store.setItem(k, v);
  } catch {}
};

function platform(): string {
  const html = document.documentElement.classList;
  if (html.contains("in-app")) return html.contains("ios") ? "ios-app" : "android-app";
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "web";
}

// The visit: kept while the visitor keeps coming back within 30 minutes.
function session() {
  const now = Date.now();
  let sid = read("gx_sid", sessionStorage) ?? read("gx_sid");
  const last = Number(read("gx_seen") ?? 0);
  let fresh = false;
  if (!sid || now - last > SESSION_GAP_MS) {
    sid = uuid();
    fresh = true;
  }
  write("gx_sid", sid, sessionStorage);
  write("gx_sid", sid);
  write("gx_seen", String(now));
  let vid = read("gx_vid");
  if (!vid) {
    vid = uuid();
    write("gx_vid", vid);
  }
  return { sid, vid, fresh };
}

let queue: Record<string, unknown>[] = [];
function send(hit: Record<string, unknown>, now = false) {
  queue.push(hit);
  if (now || queue.length >= 10) flush();
}
function flush() {
  if (!queue.length) return;
  const body = JSON.stringify(queue);
  queue = [];
  if (navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) return;
  fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}

type Page = { pv: string; sid: string; active: number; since: number | null; scroll: number; clicks: number; lastInput: number };

// Final numbers for the page being left.
function closePage(p: Page) {
  if (p.since !== null) p.active += performance.now() - p.since;
  send({ t: "ping", sid: p.sid, pv: p.pv, active_ms: Math.round(p.active), scroll: p.scroll, clicks: p.clicks }, true);
}

export function SiteTracker() {
  const path = usePathname();
  const [consent, setConsent] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const page = useRef<Page | null>(null);

  useEffect(() => {
    // Read once on the client (the banner shows only after this).
    const c = read(CONSENT_KEY);
    const t = setTimeout(() => {
      setConsent(c);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // A page view on every navigation.
  useEffect(() => {
    if (consent !== "full") return;
    const { sid, vid } = session();
    const pv = uuid();
    const prev = page.current;
    if (prev) closePage(prev);
    const now = performance.now();
    page.current = { pv, sid, active: 0, since: document.visibilityState === "visible" ? now : null, scroll: 0, clicks: 0, lastInput: now };
    const q = new URLSearchParams(location.search);
    // First touch: remember what brought them (for "where did this request come
    // from" in the control room). Kept 30 days, never overwritten.
    if (!prev && !document.cookie.includes("gx_src=")) {
      let src = q.get("utm_source") ?? (q.get("fbclid") ? "facebook" : q.get("ttclid") ? "tiktok" : null);
      if (!src && document.referrer) {
        try {
          const h = new URL(document.referrer).host.replace(/^www\./, "");
          if (h !== location.host) src = h;
        } catch {}
      }
      if (src) document.cookie = `gx_src=${encodeURIComponent(src.slice(0, 60))}; path=/; max-age=2592000; samesite=lax`;
    }
    send(
      {
        t: "view",
        sid,
        vid,
        pv,
        path,
        title: document.title,
        ref: prev ? null : document.referrer || null,
        utm_source: q.get("utm_source") ?? (q.get("fbclid") ? "facebook" : q.get("ttclid") ? "tiktok" : q.get("gclid") ? "google" : null),
        utm_medium: q.get("utm_medium"),
        utm_campaign: q.get("utm_campaign"),
        platform: platform(),
        app_version: (window as unknown as { __gymixAppVersion?: string }).__gymixAppVersion ?? null,
        screen: `${screen.width}x${screen.height}`,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      true,
    );
  }, [path, consent]);

  // Time actually spent looking (visible, and touched in the last minute),
  // scroll depth and clicks; a ping every 15 s and when leaving.
  useEffect(() => {
    if (consent !== "full") return;
    const tick = () => {
      const p = page.current;
      if (!p) return;
      const now = performance.now();
      if (p.since !== null) {
        const idleFor = now - p.lastInput;
        p.active += Math.max(0, now - p.since - Math.max(0, idleFor - IDLE_MS));
        p.since = idleFor > IDLE_MS ? null : now;
      }
    };
    const ping = (final = false) => {
      tick();
      const p = page.current;
      if (!p) return;
      write("gx_seen", String(Date.now()));
      send({ t: "ping", sid: p.sid, pv: p.pv, active_ms: Math.round(p.active), scroll: p.scroll, clicks: p.clicks }, final);
    };
    const onInput = () => {
      const p = page.current;
      if (!p) return;
      const now = performance.now();
      if (p.since === null && document.visibilityState === "visible") p.since = now;
      p.lastInput = now;
    };
    const onScroll = () => {
      onInput();
      const p = page.current;
      if (!p) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max <= 0 ? 100 : Math.round(((scrollY + 0) / max) * 100);
      p.scroll = Math.max(p.scroll, Math.min(100, pct));
    };
    const onClick = (e: MouseEvent) => {
      onInput();
      const p = page.current;
      if (!p) return;
      p.clicks += 1;
      const el = (e.target as HTMLElement | null)?.closest("a, button, [data-track]") as HTMLElement | null;
      if (!el) return;
      const label = (el.dataset.track || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const href = el instanceof HTMLAnchorElement ? el.href : null;
      let kind = "click";
      if (href && new URL(href, location.href).host !== location.host) kind = "outbound";
      else if (el.dataset.track || /\/(signup|demo|pricing|login)\b/.test(href ?? "") || /free trial|start|sign up|demo|book|join/i.test(label)) kind = "cta";
      if (el.closest("form") && (el as HTMLButtonElement).type === "submit") kind = "form";
      send({ t: "event", sid: p.sid, pv: p.pv, kind, label: label || href || el.tagName.toLowerCase(), path: location.pathname });
    };
    const onVisibility = () => {
      const p = page.current;
      if (!p) return;
      if (document.visibilityState === "hidden") {
        ping(true);
        p.since = null;
      } else {
        p.since = performance.now();
        p.lastInput = p.since;
      }
    };
    const timer = setInterval(() => ping(), 15_000);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("pointerdown", onInput, { passive: true });
    addEventListener("keydown", onInput);
    addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("pagehide", () => ping(true));
    return () => {
      clearInterval(timer);
      removeEventListener("scroll", onScroll);
      removeEventListener("pointerdown", onInput);
      removeEventListener("keydown", onInput);
      removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [consent]);

  if (!ready || consent) return null;
  return (
    <ConsentBanner
      onChoose={(c) => {
        write(CONSENT_KEY, c);
        setConsent(c);
      }}
    />
  );
}

// Asked once: a small card in the corner, never covering the page.
function ConsentBanner({ onChoose }: { onChoose: (c: "full" | "basic") => void }) {
  return (
    <div role="dialog" aria-label="Cookies" className="consent-in fixed right-4 bottom-[calc(var(--bottom-bar,0px)+1rem)] left-4 z-[60] mx-auto max-w-md rounded-3xl bg-ink p-5 text-white shadow-2xl ring-1 ring-white/10 sm:right-auto sm:left-6 sm:mx-0">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-ink">
          <Cookie className="size-5" />
        </span>
        <p className="text-sm leading-relaxed text-white/75">
          We use our own analytics (no ads, nothing sold) to see which pages help and which don&apos;t.{" "}
          <Link href="/privacy" className="text-white underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => onChoose("full")} className="h-10 flex-1 rounded-xl bg-brand text-sm font-semibold text-ink transition active:scale-[0.97]">
          Accept
        </button>
        <button type="button" onClick={() => onChoose("basic")} className="h-10 flex-1 rounded-xl text-sm font-medium text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 active:scale-[0.97]">
          Essential only
        </button>
      </div>
    </div>
  );
}
