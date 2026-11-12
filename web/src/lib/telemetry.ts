// Writes platform_events rows for the super admin dashboard (/admin).
//
// Used from the proxy, server actions and instrumentation, so it avoids
// next/headers and "server-only" and talks to PostgREST with plain fetch.
// Logging never throws and never blocks a response for long: if Supabase is
// down or the service role key is missing, events are simply dropped.

export type EventKind = "request" | "login" | "login_failed" | "signup" | "error";
export type RequestType = "page" | "navigation" | "action" | "api";

export type PlatformEvent = {
  kind: EventKind;
  request_type?: RequestType | null;
  method?: string | null;
  path?: string | null;
  user_id?: string | null;
  visitor_id?: string | null;
  ip?: string | null;
  country?: string | null;
  device?: "mobile" | "tablet" | "desktop" | "bot" | null;
  browser?: string | null;
  referrer?: string | null;
  message?: string | null;
  detail?: Record<string, unknown>;
};

export const VISITOR_COOKIE = "gx_vid";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Paths whose next segment is a secret (invite and check-in links): never stored.
const SECRET_PREFIXES = ["/join/", "/c/", "/d/"];

// The pathname with ids and secret tokens replaced, so pages group together
// and no link that grants access ends up in the log. Query strings are dropped.
export function normalizePath(pathname: string) {
  let path = pathname.split("?")[0].split("#")[0] || "/";
  for (const prefix of SECRET_PREFIXES) {
    if (path.startsWith(prefix)) {
      path = prefix + ":token" + path.slice(prefix.length).replace(/^[^/]+/, "");
    }
  }
  path = path.replace(UUID, ":id").replace(/\/\d{4,}(?=\/|$)/g, "/:n");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path.slice(0, 300);
}

type HeaderSource = { get(name: string): string | null };

export function clientIp(h: HeaderSource) {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "").slice(0, 64) || null;
}

export function clientCountry(h: HeaderSource) {
  const c = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country-code");
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python|axios|node-fetch|headless|lighthouse/i;

export function parseUserAgent(ua: string | null) {
  const s = ua ?? "";
  const device: PlatformEvent["device"] = !s || BOT.test(s)
    ? "bot"
    : /ipad|tablet|(android(?!.*mobile))/i.test(s)
      ? "tablet"
      : /mobi|iphone|android/i.test(s)
        ? "mobile"
        : "desktop";
  const browser = /edg\//i.test(s)
    ? "Edge"
    : /opr\/|opera/i.test(s)
      ? "Opera"
      : /samsungbrowser/i.test(s)
        ? "Samsung Internet"
        : /chrome|crios/i.test(s)
          ? "Chrome"
          : /firefox|fxios/i.test(s)
            ? "Firefox"
            : /safari/i.test(s)
              ? "Safari"
              : device === "bot"
                ? "Bot"
                : "Other";
  return { device, browser };
}

// The referring site's host, or null when it is this site or missing.
export function externalReferrer(referer: string | null, ownHost: string | null) {
  if (!referer) return null;
  try {
    const host = new URL(referer).host.replace(/^www\./, "");
    if (!host || (ownHost && host === ownHost.replace(/^www\./, ""))) return null;
    return host.slice(0, 200);
  } catch {
    return null;
  }
}

// Who/where a request came from, for login, sign-up and error events.
export function requestMeta(h: HeaderSource, opts: { withIp?: boolean } = {}) {
  const { device, browser } = parseUserAgent(h.get("user-agent"));
  const cookie = h.get("cookie") ?? "";
  const visitor = cookie.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`))?.[1] ?? null;
  return {
    ip: opts.withIp ? clientIp(h) : null,
    country: clientCountry(h),
    device,
    browser,
    visitor_id: visitor?.slice(0, 64) ?? null,
  };
}

function trim(value: string | null | undefined, max: number) {
  return value == null ? null : String(value).slice(0, max);
}

export function isTelemetryEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.GYMIX_TELEMETRY !== "off",
  );
}

// Inserts events. Resolves either way; never rejects.
export async function logEvents(events: PlatformEvent[]) {
  if (!events.length || !isTelemetryEnabled()) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const rows = events.map((e) => ({
    kind: e.kind,
    request_type: e.request_type ?? null,
    method: trim(e.method, 10),
    path: e.path == null ? null : normalizePath(e.path),
    user_id: e.user_id ?? null,
    visitor_id: trim(e.visitor_id, 64),
    ip: trim(e.ip, 64),
    country: trim(e.country, 8),
    device: e.device ?? null,
    browser: trim(e.browser, 40),
    referrer: trim(e.referrer, 200),
    message: trim(e.message, 1000),
    detail: e.detail ?? {},
  }));
  try {
    await fetch(`${url}/rest/v1/platform_events`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
  } catch {
    // Monitoring must never break the site.
  }
}

export function logEvent(event: PlatformEvent) {
  return logEvents([event]);
}
