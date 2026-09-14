/* Service Worker STARNÉT AFRIC */

const CACHE = "starnet-v6";
const CORE = [
  "/", "/index.html", "/forfaits.html", "/commandes.html", "/statut.html",
  "/contact.html", "/verify-payment.html", "/404.html",
  "/css/style.css", "/js/common.js", "/js/forfaits.js",
  "/manifest.webmanifest", "/assets/favicon.svg",
  "/assets/icon-192.png", "/assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate" || url.pathname.startsWith("/js/") || url.pathname.startsWith("/css/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
    )
  );
});
