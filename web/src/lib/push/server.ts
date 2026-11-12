import "server-only";
import crypto from "node:crypto";
import http2 from "node:http2";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends one notification to every phone of the person it's for:
//   web   installed web app, Web Push (keys made on first use, kept in the DB)
//   fcm   Android app, Firebase (needs FIREBASE_SERVICE_ACCOUNT)
//   apns  iPhone app, Apple (needs APNS_KEY, APNS_KEY_ID, APPLE_TEAM_ID)
// Phones that are gone (uninstalled, logged out) are forgotten.

// The notification sound. Native apps play this file when it's bundled
// (Android: res/raw/<name>, iOS: <name>.caf); until then, the phone's default.
export const PUSH_SOUND = process.env.GYMIX_PUSH_SOUND || "default";
const ANDROID_CHANNEL = "gymix";

// Which profile switch (Profile → Notifications) covers each kind.
const PREF_FOR: Record<string, string> = {
  message: "messages",
  class: "classes",
  course: "classes",
  pt: "classes",
  billing: "payments",
  reminder: "training",
  record: "training",
  program: "training",
  nutrition: "training",
  challenge: "training",
};

type Keys = { publicKey: string; privateKey: string };
let cachedKeys: Keys | null = null;

// The Web Push keys: made once, then shared by every server instance.
export async function vapidKeys(): Promise<Keys> {
  if (cachedKeys) return cachedKeys;
  const admin = createAdminClient();
  const { data } = await admin.from("platform_secrets").select("vapid_public, vapid_private").single();
  if (data?.vapid_public && data.vapid_private) {
    cachedKeys = { publicKey: data.vapid_public, privateKey: data.vapid_private };
    return cachedKeys;
  }
  const made = webpush.generateVAPIDKeys();
  // Only fills empty keys, so two servers starting at once agree on one pair.
  await admin.from("platform_secrets").update({ vapid_public: made.publicKey, vapid_private: made.privateKey }).eq("vapid_public", "");
  const { data: saved } = await admin.from("platform_secrets").select("vapid_public, vapid_private").single();
  cachedKeys = { publicKey: saved!.vapid_public, privateKey: saved!.vapid_private };
  return cachedKeys;
}

// Tells the database where to send "push this" calls. Follows the live
// domain, so a domain change needs nothing.
export async function rememberDispatchUrl(origin: string) {
  const url = `${origin}/api/push/dispatch`;
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost/.test(url)) return;
  await createAdminClient().from("platform_secrets").update({ push_dispatch_url: url }).neq("push_dispatch_url", url);
}

export const nativePushReady = {
  android: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
  ios: Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APPLE_TEAM_ID),
};

type Payload = { id: string; title: string; body: string; link: string; kind: string; badge: number };

// Sends notification `id` once (the first caller marks it sent).
export async function dispatchNotification(id: string) {
  const admin = createAdminClient();
  const { data: n } = await admin
    .from("notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("push_sent_at", null)
    .select("id, user_id, kind, title, body, link, read_at")
    .maybeSingle();
  if (!n || n.read_at) return { sent: 0, reason: "already sent or read" };

  const [{ data: profile }, { data: subs }, { count: unread }] = await Promise.all([
    admin.from("profiles").select("notify_prefs").eq("id", n.user_id).maybeSingle(),
    admin.from("push_subscriptions").select("id, kind, endpoint, p256dh, auth").eq("user_id", n.user_id),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", n.user_id).is("read_at", null),
  ]);
  const pref = PREF_FOR[n.kind];
  const prefs = (profile?.notify_prefs ?? {}) as Record<string, boolean>;
  if (pref && prefs[pref] === false) return { sent: 0, reason: "turned off" };
  if (!subs?.length) return { sent: 0, reason: "no phones" };

  const payload: Payload = { id: n.id, title: n.title, body: n.body ?? "", link: n.link ?? "/", kind: n.kind, badge: unread ?? 1 };
  const gone: string[] = [];
  const ok: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const result = s.kind === "web" ? await sendWeb(s, payload) : s.kind === "fcm" ? await sendFcm(s.endpoint, payload) : await sendApns(s.endpoint, payload);
        if (result === "gone") gone.push(s.id);
        else if (result === "ok") ok.push(s.id);
      } catch (e) {
        console.error("push failed", s.kind, e instanceof Error ? e.message : e);
      }
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  if (ok.length) await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).in("id", ok);
  return { sent: ok.length, gone: gone.length };
}

type Result = "ok" | "gone" | "skipped";

async function sendWeb(s: { endpoint: string; p256dh: string | null; auth: string | null }, p: Payload): Promise<Result> {
  if (!s.p256dh || !s.auth) return "gone";
  const keys = await vapidKeys();
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(p),
      { vapidDetails: { subject: process.env.NEXT_PUBLIC_CONTACT_EMAIL ? `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}` : "https://gymix.app", publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24, urgency: "high", topic: p.id.replace(/-/g, "").slice(0, 32) },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    throw e;
  }
}

// ---------------------------------------------------------------- Firebase
let fcmToken: { value: string; until: number } | null = null;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function fcmAccessToken(sa: { client_email: string; private_key: string }) {
  if (fcmToken && fcmToken.until > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signature = base64url(crypto.sign("RSA-SHA256", Buffer.from(`${head}.${claims}`), sa.private_key));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${signature}` }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Firebase login failed");
  fcmToken = { value: json.access_token, until: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return fcmToken.value;
}

async function sendFcm(token: string, p: Payload): Promise<Result> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return "skipped";
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await fcmAccessToken(sa)}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: p.title, body: p.body },
        data: { link: p.link, kind: p.kind, id: p.id },
        android: {
          priority: "high",
          notification: { channel_id: ANDROID_CHANNEL, sound: PUSH_SOUND, color: "#C8F135", icon: "ic_stat_gymix", tag: p.id, notification_count: p.badge },
        },
      },
    }),
  });
  if (res.ok) return "ok";
  const text = await res.text();
  if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT")) return "gone";
  throw new Error(`FCM ${res.status}: ${text.slice(0, 200)}`);
}

// ------------------------------------------------------------------- Apple
let apnsJwt: { value: string; until: number } | null = null;

function apnsToken() {
  if (apnsJwt && apnsJwt.until > Date.now()) return apnsJwt.value;
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const claims = base64url(JSON.stringify({ iss: process.env.APPLE_TEAM_ID, iat: now }));
  const key = (process.env.APNS_KEY ?? "").replace(/\\n/g, "\n");
  const signature = base64url(crypto.sign("SHA256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" }));
  // Apple wants a fresh token at least every hour, and not more than every 20 minutes.
  apnsJwt = { value: `${head}.${claims}.${signature}`, until: Date.now() + 40 * 60_000 };
  return apnsJwt.value;
}

function sendApns(token: string, p: Payload): Promise<Result> {
  if (!nativePushReady.ios) return Promise.resolve("skipped");
  const host = process.env.APNS_PRODUCTION === "1" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const body = JSON.stringify({
    aps: { alert: { title: p.title, body: p.body }, sound: PUSH_SOUND === "default" ? "default" : `${PUSH_SOUND}.caf`, badge: p.badge, "thread-id": p.kind, "mutable-content": 1 },
    link: p.link,
    id: p.id,
  });
  return new Promise((resolve, reject) => {
    const client = http2.connect(host);
    client.on("error", reject);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsToken()}`,
      "apns-topic": process.env.GYMIX_APP_ID || "com.gymix.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": p.id.slice(0, 64),
      "content-type": "application/json",
    });
    let status = 0;
    let out = "";
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (d) => (out += d));
    req.on("end", () => {
      client.close();
      if (status === 200) resolve("ok");
      else if (status === 410 || out.includes("BadDeviceToken") || out.includes("Unregistered")) resolve("gone");
      else reject(new Error(`APNs ${status}: ${out.slice(0, 200)}`));
    });
    req.on("error", (e) => {
      client.close();
      reject(e);
    });
    req.end(body);
  });
}
