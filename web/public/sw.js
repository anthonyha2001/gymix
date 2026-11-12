// Gymix service worker: installable app + offline mode.
//
//   App files (/_next/static, icons, fonts): kept on the phone, served from it.
//   Member and staff pages (/portal, /dashboard): live first. If the network
//     is slow (4 s) or gone, the copy saved on the phone is shown instead and
//     the live page replaces it in the background when it arrives.
//   Anything else (API, actions, door taps): always live, never stored.
//   No saved copy: the Gymix offline page.
// Saved pages are forgotten on the login page ("forget-pages"), so the next
// person on a shared phone never sees the last one's pages. Changes made
// offline live in IndexedDB (lib/outbox.ts), not here.
const STATIC = "gx-static-v1";
const PAGES = "gx-pages-v1";
const OFFLINE_URL = "/offline";
const SLOW_MS = 4000;
const MAX_PAGES = 60;
const MAX_STATIC = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname);
const isSavedPage = (url) => /^\/(portal|dashboard)(\/|$)/.test(url.pathname);

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function fromStatic(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    cache.put(request, res.clone()).then(() => trim(STATIC, MAX_STATIC));
  }
  return res;
}

async function savePage(request, res) {
  const type = res.headers.get("content-type") || "";
  if (!res.ok || res.redirected || res.type !== "basic" || !type.includes("text/html")) return;
  const cache = await caches.open(PAGES);
  await cache.put(request.url, res);
  await trim(PAGES, MAX_PAGES);
}

async function savedCopy(request) {
  const cache = await caches.open(PAGES);
  return (await cache.match(request.url)) || (await cache.match(request.url, { ignoreSearch: true })) || null;
}

async function offlinePage() {
  const cache = await caches.open(PAGES);
  return (await cache.match(OFFLINE_URL)) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
}

async function navigate(event) {
  const { request } = event;
  const url = new URL(request.url);
  const keep = isSavedPage(url);
  const live = fetch(request).then((res) => {
    if (keep) event.waitUntil(savePage(request, res.clone()));
    return res;
  });
  if (!keep) return live.catch(() => offlinePage());

  // Live first; a saved copy if the network is gone or too slow.
  const slow = new Promise((resolve) => setTimeout(resolve, SLOW_MS, "slow"));
  try {
    const first = await Promise.race([live, slow]);
    if (first !== "slow") return first;
    const copy = await savedCopy(request);
    if (copy) {
      event.waitUntil(live.catch(() => {}));
      return copy;
    }
    return await live;
  } catch {
    return (await savedCopy(request)) || offlinePage();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
  } else if (isStatic(url)) {
    event.respondWith(fromStatic(request));
  }
  // Everything else (page data, APIs) goes to the network untouched. When an
  // in-app navigation fails offline, the app reloads the page, which lands
  // in navigate() above.
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "forget-pages") {
    // Every saved page goes, except the offline page itself (which may not be
    // fetchable again right now).
    event.waitUntil(
      caches
        .open(PAGES)
        .then(async (c) => {
          for (const key of await c.keys()) {
            if (new URL(key.url).pathname !== OFFLINE_URL) await c.delete(key);
          }
        })
        .catch(() => {}),
    );
  }
  // Save the member's main pages in the background, so they open offline
  // even if they weren't visited yet.
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(
      Promise.all(
        data.urls
          .filter((u) => typeof u === "string" && isSavedPage(new URL(u, self.location.origin)))
          .slice(0, 8)
          .map((u) => {
            const request = new Request(new URL(u, self.location.origin).href, {
              credentials: "same-origin",
              headers: { Accept: "text/html", "X-Gymix-Warm": "1" },
            });
            return fetch(request)
              .then(async (res) => {
                const html = await res.clone().text();
                await savePage(request, res);
                // The scripts and styles the page needs, so it works offline too.
                const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])].slice(0, 60);
                await Promise.all(assets.map((a) => fromStatic(new Request(a)).catch(() => {})));
              })
              .catch(() => {});
          }),
      ),
    );
  }
});

// ------------------------------------------------------------------- push
// A notification from Gymix (see lib/push/server.ts). Shown even when the app
// is closed; tapping it opens (or focuses) the app on the right page.
self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    p = { title: "Gymix", body: event.data ? event.data.text() : "" };
  }
  const title = p.title || "Gymix";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: p.body || "",
        icon: "/icons/192",
        badge: "/icons/badge",
        tag: p.id || undefined,
        renotify: Boolean(p.id),
        vibrate: [40, 60, 40],
        timestamp: Date.now(),
        data: { link: p.link || "/", id: p.id },
      }),
      // The red count on the home-screen icon, where the phone supports it.
      self.navigator && "setAppBadge" in self.navigator && p.badge ? self.navigator.setAppBadge(p.badge).catch(() => {}) : null,
      // Open copies of the app refresh their bell.
      self.clients.matchAll({ type: "window" }).then((list) => list.forEach((c) => c.postMessage({ type: "push", id: p.id }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = new URL((event.notification.data && event.notification.data.link) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) return open.focus().then((c) => (c && "navigate" in c ? c.navigate(link) : null));
      return self.clients.openWindow(link);
    }),
  );
});

// The browser replaced this phone's subscription: save the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => list.forEach((c) => c.postMessage({ type: "push-resubscribe" }))),
  );
});
