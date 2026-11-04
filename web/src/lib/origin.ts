import "server-only";
import { headers } from "next/headers";

// The site's own origin as the visitor reached it (used for sticker links).
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.") || /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
