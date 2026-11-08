import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  VISITOR_COOKIE,
  clientCountry,
  externalReferrer,
  isTelemetryEnabled,
  logEvent,
  parseUserAgent,
  type RequestType,
} from "@/lib/telemetry";

const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/onboarding", "/admin"];

// Called by door hardware, not people.
const DEVICE_PATHS = ["/iclock/", "/api/access/hikvision/", "/api/occupancy/", "/api/screens/"];

// Files the browser fetches on its own; not worth logging as traffic.
const UNTRACKED = ["/sw.js", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/icons/", "/_next/"];

// What kind of request this is, or null when it shouldn't be logged
// (prefetches, background files, HEAD/OPTIONS).
function requestType(request: NextRequest): RequestType | null {
  const h = request.headers;
  const { pathname } = request.nextUrl;
  if (UNTRACKED.some((p) => pathname === p || pathname.startsWith(p))) return null;
  if (h.has("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) {
    return null;
  }
  if (request.method === "POST" && h.has("next-action")) return "action";
  if (request.method === "GET" && h.get("rsc") === "1") return "navigation";
  if (request.method === "GET" && (h.get("accept") ?? "").includes("text/html")) return "page";
  if (request.method === "HEAD" || request.method === "OPTIONS") return null;
  return "api";
}

// Refreshes the Supabase session cookie on every request and bounces
// signed-out users away from app pages. Pages still check auth themselves;
// this is only the first line of defence. Also records the request for the
// super admin dashboard, after the response is sent.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Door devices and the Gymix Bridge call these every few seconds: no session
  // to refresh and nothing worth logging as traffic.
  const path = request.nextUrl.pathname;
  if (path === "/api/access/bridge" || DEVICE_PATHS.some((p) => path.startsWith(p))) return NextResponse.next();
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims checks the token's signature locally; it only calls the auth
  // server to refresh an expired session.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  const { pathname } = request.nextUrl;
  if (!userId && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    response = NextResponse.redirect(login);
  }

  track(request, event, response, userId);
  return response;
}

function track(request: NextRequest, event: NextFetchEvent, response: NextResponse, userId: string | null) {
  if (!isTelemetryEnabled()) return;
  const type = requestType(request);
  if (!type) return;

  const h = request.headers;
  const { device, browser } = parseUserAgent(h.get("user-agent"));
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  // An anonymous id per browser, so visits can be counted as unique visitors.
  if (!visitorId && device !== "bot") {
    visitorId = crypto.randomUUID();
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  event.waitUntil(
    logEvent({
      kind: "request",
      request_type: type,
      method: request.method,
      path: request.nextUrl.pathname,
      user_id: userId,
      visitor_id: visitorId,
      country: clientCountry(h),
      device,
      browser,
      // Only full page loads carry a meaningful referrer.
      referrer: type === "page" ? externalReferrer(h.get("referer"), h.get("x-forwarded-host") ?? h.get("host")) : null,
      detail: response.status >= 300 && response.status < 400 ? { redirected: true } : {},
    }),
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
