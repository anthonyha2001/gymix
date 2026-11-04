// Gymix service worker: makes the app installable. Pages always come from the
// network (gym data must be live); nothing is cached here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
