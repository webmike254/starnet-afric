/* Service Worker — Starlink / Starnét Afric PWA */

const CACHE = "starnet-v7";
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
  "/js/forfaits.js",
  "/js/commandes.js",
  "/js/statut.js",
  "/js/contact.js",
  "/js/index.js",
  "/manifest.webmanifest",
  "/assets/favicon.svg",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        CORE.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API
  if (url.pathname.startsWith("/api/")) return;

  // HTML / navigations: network first, offline shell = forfaits
  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNav) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (r) =>
              r ||
              caches.match("/forfaits.html") ||
              caches.match("/index.html")
          )
        )
    );
    return;
  }

  // JS + CSS: network first so updates apply quickly
  if (url.pathname.startsWith("/js/") || url.pathname.startsWith("/css/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Assets: cache first
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
    )
  );
});

// Allow page to ask SW to skip waiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
