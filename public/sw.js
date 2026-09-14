/* Service Worker STARNÉT AFRIC — PWA installable & consultation hors-ligne. */

const CACHE = "starnet-v3";
const CORE = [
  "/",
  "/index.html",
  "/forfaits.html",
  "/commandes.html",
  "/statut.html",
  "/contact.html",
  "/verify-payment.html",
  "/404.html",
  "/css/style.css",
  "/js/common.js",
  "/js/index.js",
  "/js/forfaits.js",
  "/js/commandes.js",
  "/js/statut.js",
  "/js/contact.js",
  "/manifest.webmanifest",
  "/assets/favicon.svg",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/logos/moov.svg",
  "/assets/logos/orange.svg",
  "/assets/logos/airtel.svg",
  "/assets/logos/mtn.svg",
  "/assets/logos/mpesa.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // APIs never cached
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((r) => r || caches.match("/index.html"))
        )
    );
    return;
  }

  // JS: network first
  if (url.pathname.startsWith("/js/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other assets: cache first
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
