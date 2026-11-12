"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { requestOrigin } from "@/lib/origin";
import { nativePushReady, rememberDispatchUrl, vapidKeys } from "@/lib/push/server";

export type PushKind = "web" | "fcm" | "apns";

// What this browser/app needs before it can subscribe.
export async function pushSetup() {
  return { publicKey: (await vapidKeys()).publicKey, native: nativePushReady };
}

// Saves this phone for the signed-in person, and makes sure the database
// knows where to send pushes.
export async function savePushSubscription(sub: { kind: PushKind; endpoint: string; p256dh?: string; auth?: string; platform?: string }) {
  const viewer = await getViewer();
  if (!viewer) return { error: "Log in first" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_kind: sub.kind,
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_platform: sub.platform,
  });
  if (error) return { error: error.message };
  await rememberDispatchUrl(await requestOrigin());
  return { ok: true as const };
}

// Forgets this phone (notifications turned off here).
export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true as const };
}

// "Send me a test": a real notification through the whole path.
export async function sendTestPush() {
  const viewer = await getViewer();
  if (!viewer) return { error: "Log in first" };
  const gymId = viewer.memberships[0]?.gymId;
  if (!gymId) return { error: "Join a gym first" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("notify_me_test", { p_gym_id: gymId });
  if (error) return { error: error.message };
  return { ok: true as const };
}
