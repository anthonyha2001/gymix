"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isUnreachable, UNREACHABLE_MESSAGE } from "@/lib/supabase/config";
import { homePathForUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { identifierType, logAuthEvent } from "@/lib/telemetry-server";

export type AuthFormState = { error?: string; message?: string; email?: string };

const NOT_CONFIGURED = "Gymix isn't connected to its database yet. See the README to finish setup.";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Only same-site paths, so a crafted ?next= can't send people to another website.
function safeNext(formData: FormData) {
  const next = text(formData, "next");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

// Members can log in with their phone number or member code instead of an
// email; this finds the account's email for them (server-side only).
async function loginEmail(identifier: string) {
  if (identifier.includes("@")) return identifier;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient().rpc("member_login_email", { p_identifier: identifier });
  return data ?? null;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const identifier = text(formData, "email");
  const password = formData.get("password");
  if (!identifier || typeof password !== "string" || !password) {
    return { error: "Enter your email, phone or member code, and your password.", email: identifier };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, email: identifier };

  const via = identifierType(identifier);
  const failed = (reason: string) =>
    logAuthEvent({ kind: "login_failed", path: "/login", message: identifier.slice(0, 100), detail: { reason, via } });

  const email = await loginEmail(identifier);
  if (!email) {
    await failed("unknown login");
    return { error: "Wrong login or password.", email: identifier };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (isUnreachable(error)) return { error: UNREACHABLE_MESSAGE, email: identifier };
    if (error.code === "email_not_confirmed") {
      await failed("email not confirmed");
      return { error: "Confirm your email first — check your inbox for the link.", email: identifier };
    }
    await failed(error.code ?? "wrong password");
    return { error: "Wrong login or password.", email: identifier };
  }
  await logAuthEvent({ kind: "login", path: "/login", user_id: data.user.id, message: "password", detail: { via } });

  // Pick up any gym invites sent to this email since the account was created.
  await supabase.rpc("claim_my_invites");
  redirect(safeNext(formData) ?? (await homePathForUser(supabase, data.user.id)));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email");
  const password = formData.get("password");

  if (fullName.length < 2) return { error: "Enter your full name.", email };
  if (!email.includes("@")) return { error: "Enter a valid email address.", email };
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters.", email };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, email };

  // The public site URL wins so confirmation links never point at localhost in production.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get("origin") || "").replace(/\/+$/, "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    if (isUnreachable(error)) return { error: UNREACHABLE_MESSAGE, email };
    if (error.code === "user_already_exists") {
      return { error: "An account with this email already exists. Log in instead.", email };
    }
    if (error.code === "weak_password") return { error: error.message, email };
    return { error: "Couldn't create your account. Please try again.", email };
  }
  if (data.user) await logAuthEvent({ kind: "signup", path: "/signup", user_id: data.user.id, message: "email" });

  // Email confirmation is on: no session until they click the link.
  if (!data.session || !data.user) {
    return { message: `We sent a confirmation link to ${email}. Open it to finish signing up.` };
  }
  redirect(safeNext(formData) ?? (await homePathForUser(supabase, data.user.id)));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
