import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { logEvent, requestMeta, type PlatformEvent } from "@/lib/telemetry";

type AuthEvent = Pick<PlatformEvent, "user_id" | "message" | "detail"> & {
  kind: "login" | "login_failed" | "signup";
  path: string;
};

// Records a login, failed login or sign-up (with the visitor's IP and country)
// after the response is sent. For server actions and route handlers.
export async function logAuthEvent(event: AuthEvent) {
  const meta = requestMeta(await headers(), { withIp: true });
  after(() => logEvent({ ...meta, ...event }));
}

// How someone typed their login, without saying what it was.
export function identifierType(identifier: string) {
  if (identifier.includes("@")) return "email";
  return /^[+\d\s()-]{6,}$/.test(identifier) ? "phone" : "member code";
}
