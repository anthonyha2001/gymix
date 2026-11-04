import { logEvent, requestMeta } from "@/lib/telemetry";

// Browser errors reported by the app's error pages (server errors are already
// recorded by instrumentation.ts). Same-site only, small payloads only.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const sameSite = origin ? Boolean(host) && new URL(origin).host === host : request.headers.get("sec-fetch-site") === "same-origin";
  if (!sameSite) return new Response(null, { status: 403 });

  const raw = await request.text();
  if (raw.length > 8000) return new Response(null, { status: 413 });
  let body: { message?: unknown; stack?: unknown; path?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "Unknown error";
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/";
  const stack = typeof body.stack === "string" ? body.stack.split("\n").slice(0, 12).join("\n") : undefined;

  await logEvent({
    kind: "error",
    method: "GET",
    path,
    ...requestMeta(request.headers),
    message,
    detail: { source: "browser", stack },
  });
  return new Response(null, { status: 204 });
}
