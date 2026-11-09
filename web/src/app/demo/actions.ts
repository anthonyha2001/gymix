"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { cleanupDemos, createDemo, deleteDemoFor, demoPartner, demoPassword, isDemoEmail, visitorHash } from "@/lib/demo";
import type { ActionState } from "@/lib/action-result";

async function signInAs(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: demoPassword(email) });
  return error;
}

// "Start the demo": a fresh sample gym, signed in as its owner, guide on.
export async function startDemo(): Promise<ActionState> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const result = await createDemo(visitorHash(ip));
  if ("error" in result) return { error: result.error };
  // A visitor's earlier sample gym goes away when they start a new one.
  const viewer = await getViewer();
  if (viewer && isDemoEmail(viewer.email)) await deleteDemoFor(viewer.id);
  const error = await signInAs(result.ownerEmail);
  if (error) return { error: "The demo couldn't sign you in. Please try again." };
  after(() => cleanupDemos());
  redirect("/dashboard?guide=welcome");
}

// Owner dashboard <-> the sample member's app, same sample gym.
export async function switchDemoRole(to: "owner" | "member") {
  const viewer = await getViewer();
  if (!viewer || !isDemoEmail(viewer.email)) redirect("/demo");
  const email = await demoPartner(viewer.id, to);
  if (!email || (await signInAs(email))) redirect("/demo");
  redirect(to === "member" ? "/portal" : "/dashboard");
}

// Leaves the demo: the sample gym is deleted right away.
export async function endDemo(next: "signup" | "home") {
  const viewer = await getViewer();
  if (viewer && isDemoEmail(viewer.email)) {
    await (await createClient()).auth.signOut();
    await deleteDemoFor(viewer.id);
  }
  redirect(next === "signup" ? "/signup" : "/");
}
