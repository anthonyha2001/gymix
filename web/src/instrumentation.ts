import type { Instrumentation } from "next";

// Every server error (page render, server action, route handler, proxy) is
// recorded for the super admin dashboard's Errors tab.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logEvent, parseUserAgent, clientCountry } = await import("@/lib/telemetry");
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const header = (name: string) => {
    const v = request.headers[name];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  const { device, browser } = parseUserAgent(header("user-agent"));
  await logEvent({
    kind: "error",
    method: request.method,
    path: request.path,
    country: clientCountry({ get: header }),
    device,
    browser,
    message: `${error.name && error.name !== "Error" ? `${error.name}: ` : ""}${error.message || "Unknown error"}`,
    detail: {
      source: "server",
      digest,
      route: context.routePath,
      route_type: context.routeType,
      render_source: "renderSource" in context ? context.renderSource : undefined,
      stack: error.stack?.split("\n").slice(0, 12).join("\n"),
    },
  });
};
