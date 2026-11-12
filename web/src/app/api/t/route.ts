import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { clientCountry, parseUserAgent } from "@/lib/telemetry";
import type { Json } from "@/lib/supabase/database.types";

// The site's own analytics endpoint (components/site-tracker.tsx). Takes a
// small batch of hits, adds what only the server knows (country and city from
// the connection, device and browser, who's signed in) and hands each to
// public.site_track. Same-site only; bots are ignored.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function os(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

const decode = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

// Ids in paths become ":id", so pages group together and nothing private leaks.
const cleanPath = (p: unknown) =>
  typeof p === "string" && p.startsWith("/")
    ? p
        .split("?")[0]
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
        .replace(/\/(d|c|join|p|screen|kiosk)\/[^/]+/, "/$1/:token")
        .slice(0, 300)
    : "/";

export async function POST(request: NextRequest) {
  const h = request.headers;
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) return new NextResponse(null, { status: 403 });
  const ua = h.get("user-agent") ?? "";
  const { device, browser } = parseUserAgent(ua);
  if (device === "bot") return new NextResponse(null, { status: 204 });

  const raw = await request.text();
  if (raw.length > 20_000) return new NextResponse(null, { status: 413 });
  let hits: Record<string, unknown>[];
  try {
    const body = JSON.parse(raw);
    hits = (Array.isArray(body) ? body : [body]).slice(0, 25);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const needsViewer = hits.some((x) => x.t === "view");
  const viewer = needsViewer ? await getViewer().catch(() => null) : null;
  const geo = {
    country: clientCountry(h),
    region: decode(h.get("x-vercel-ip-country-region")),
    city: decode(h.get("x-vercel-ip-city")),
    lat: Number(h.get("x-vercel-ip-latitude")) || null,
    lng: Number(h.get("x-vercel-ip-longitude")) || null,
  };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  for (const x of hits) {
    if (typeof x.sid !== "string" || !UUID.test(x.sid)) continue;
    if (x.pv != null && (typeof x.pv !== "string" || !UUID.test(x.pv))) continue;
    let hit: Record<string, unknown>;
    if (x.t === "view") {
      let refHost: string | null = null;
      try {
        refHost = typeof x.ref === "string" && x.ref ? new URL(x.ref).host.replace(/^www\./, "") : null;
        if (refHost === host) refHost = null;
      } catch {}
      hit = {
        t: "view",
        sid: x.sid,
        vid: typeof x.vid === "string" ? x.vid.slice(0, 64) : x.sid,
        pv: x.pv,
        path: cleanPath(x.path),
        title: typeof x.title === "string" ? x.title.slice(0, 200) : null,
        ref: refHost ? String(x.ref).slice(0, 300) : null,
        ref_host: refHost,
        utm_source: typeof x.utm_source === "string" ? x.utm_source : null,
        utm_medium: typeof x.utm_medium === "string" ? x.utm_medium : null,
        utm_campaign: typeof x.utm_campaign === "string" ? x.utm_campaign : null,
        uid: viewer?.id ?? null,
        ...geo,
        device,
        browser,
        os: os(ua),
        platform: x.platform,
        app_version: typeof x.app_version === "string" ? x.app_version : null,
        screen: typeof x.screen === "string" ? x.screen : null,
        lang: typeof x.lang === "string" ? x.lang : null,
        tz: typeof x.tz === "string" ? x.tz : null,
      };
    } else if (x.t === "ping") {
      hit = { t: "ping", sid: x.sid, pv: x.pv, active_ms: Number(x.active_ms) || 0, scroll: Number(x.scroll) || 0, clicks: Number(x.clicks) || 0 };
    } else if (x.t === "event") {
      hit = { t: "event", sid: x.sid, pv: x.pv, kind: x.kind, label: typeof x.label === "string" ? x.label.slice(0, 200) : null, path: cleanPath(x.path) };
    } else continue;
    await db.rpc("site_track", { p: hit as Json });
  }
  return new NextResponse(null, { status: 204 });
}
