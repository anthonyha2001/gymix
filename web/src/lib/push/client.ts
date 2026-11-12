"use client";

import { isNativeApp, nativePlatform } from "@/lib/native";
import { pushSetup, removePushSubscription, savePushSubscription } from "@/app/push-actions";

// Turning push notifications on and off on this phone, in the browser (Web
// Push through the service worker) or in the iPhone / Android app.

export type PushState = "on" | "off" | "blocked" | "install-first" | "unsupported" | "not-ready";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// The service worker that shows pushes. Registered here too, since not every
// page mounts the install banner (which normally registers it).
async function worker(): Promise<ServiceWorkerRegistration | null> {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
}

export async function pushState(): Promise<PushState> {
  if (isNativeApp()) {
    const setup = await pushSetup();
    if (!setup.native[nativePlatform() === "ios" ? "ios" : "android"]) return "not-ready";
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const p = await PushNotifications.checkPermissions();
    return p.receive === "granted" ? "on" : p.receive === "denied" ? "blocked" : "off";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // iPhones only allow notifications once Gymix is on the Home Screen.
    return isIos() && !isStandalone() ? "install-first" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const reg = await worker();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  if (isNativeApp()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const p = await PushNotifications.requestPermissions();
    if (p.receive !== "granted") return "blocked";
    await registerNative();
    return "on";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const { publicKey } = await pushSetup();
  const reg = await worker();
  if (!reg) throw new Error("No service worker");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  await saveWeb(sub);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (isNativeApp()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const token = localStorage.getItem("gymix:push-token");
    if (token) await removePushSubscription(token);
    await PushNotifications.unregister().catch(() => {});
    localStorage.removeItem("gymix:push-token");
    return "off";
  }
  const reg = await worker();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

async function saveWeb(sub: PushSubscription) {
  const json = sub.toJSON();
  await savePushSubscription({ kind: "web", endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, platform: navigator.userAgent.slice(0, 60) });
}

// Keeps this phone's subscription saved (it can change, or the account on the
// phone can change). Called on app start, at most once a day.
export async function refreshPush() {
  try {
    const last = Number(localStorage.getItem("gymix:push-saved") ?? 0);
    if (Date.now() - last < 24 * 3600_000) return;
    if (isNativeApp()) {
      if ((await pushState()) === "on") await registerNative();
    } else if ("serviceWorker" in navigator && "PushManager" in window && Notification.permission === "granted") {
      const sub = await (await worker())?.pushManager.getSubscription();
      if (sub) await saveWeb(sub);
    }
    localStorage.setItem("gymix:push-saved", String(Date.now()));
  } catch {
    // Try again next time.
  }
}

let nativeListening = false;

// Native: get this device's token and save it; taps on notifications open
// the right page.
async function registerNative() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  if (!nativeListening) {
    nativeListening = true;
    await PushNotifications.addListener("registration", async ({ value }) => {
      localStorage.setItem("gymix:push-token", value);
      await savePushSubscription({ kind: nativePlatform() === "ios" ? "apns" : "fcm", endpoint: value, platform: nativePlatform() });
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const link = (notification.data as { link?: string } | undefined)?.link;
      if (link?.startsWith("/")) window.location.assign(link);
    });
  }
  if (nativePlatform() === "android") {
    // The channel decides the sound and importance on Android 8+.
    await PushNotifications.createChannel({ id: "gymix", name: "Gymix", description: "Messages, classes and reminders from your gym", importance: 5, visibility: 1, vibration: true, lights: true, lightColor: "#C8F135" }).catch(() => {});
  }
  await PushNotifications.register();
}
