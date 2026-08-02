/* AiDHD minimal service worker — enables installability; network-first. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open("aidhd-shell-v1").then((cache) => cache.addAll(["/groups"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => res)
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/groups"))),
  );
});
