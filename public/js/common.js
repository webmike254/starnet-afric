"use strict";

/* Shared utilities + PWA install (Starlink) */

function getParam(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}

function toast(message, type) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : type === "success" ? " success" : "");
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function api(url, opts) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    ...opts,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || "Erreur (" + res.status + ")");
  return data;
}

function formatMontant(montant, devise) {
  if (montant == null) return "Sur devis";
  try {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant) + " " + devise;
  } catch (_) {
    return montant.toLocaleString("fr-FR") + " " + devise;
  }
}

function esc(s) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => map[c] || c);
}

const LOGOS_SVG = { moov: 1, orange: 1, airtel: 1, mtn: 1, mpesa: 1, vodacom: 1, ecocash: 1, lumitel: 1, waafi: 1 };
function logoOperateur(code, nom) {
  const el = document.createElement("div");
  el.className = "pay-badge";
  el.dataset.code = code;
  const codeNorm = String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (LOGOS_SVG[codeNorm]) {
    const img = document.createElement("img");
    img.src = "/assets/logos/" + codeNorm + ".svg";
    img.alt = nom || code;
    img.loading = "lazy";
    el.appendChild(img);
  } else {
    el.textContent = nom || code;
  }
  return el;
}

async function hydrateFooter() {
  try {
    const c = await api("/api/config-public");
    document.querySelectorAll("[data-site]").forEach((el) => {
      const key = el.getAttribute("data-site");
      const val = c.site && c.site[key];
      if (val) el.textContent = val;
    });
  } catch (_) {}
}

function initNav() {
  const burger = document.querySelector(".nav-burger");
  const links = document.querySelector(".nav-links");
  if (burger && links) burger.addEventListener("click", () => links.classList.toggle("open"));
  const actuel = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href").split("?")[0].split("/").pop();
    if (href === actuel || (actuel === "index.html" && href === "index.html")) a.classList.add("active");
  });
}

function envoyerVisite() {
  try {
    if (!/^\/api\//.test(location.pathname)) {
      const p = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
      if (navigator.sendBeacon) navigator.sendBeacon("/api/visit?p=" + p);
      else fetch("/api/visit?p=" + p, { method: "GET", keepalive: true }).catch(() => {});
    }
  } catch (_) {}
}

const BOTTOM_NAV = [
  { href: "/index.html", label: "Statut", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/></svg>' },
  { href: "/forfaits.html", label: "Forfaits", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' },
  { href: "/commandes.html", label: "Commandes", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2 3h3l2.6 12.5a2 2 0 0 0 2 1.5h8.9a2 2 0 0 0 2-1.5L22 8H6"/></svg>' },
  { href: "/contact.html", label: "Contact", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>' }
];

function initBottomNav() {
  if (/^\/admin/.test(location.pathname)) return;
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  const actif = location.pathname.split("/").pop() || "index.html";
  BOTTOM_NAV.forEach((item) => {
    const href = item.href.split("/").pop();
    const a = document.createElement("a");
    a.href = item.href;
    a.innerHTML = item.icon + "<span>" + item.label + "</span>";
    if (href === actif || (actif === "index.html" && href === "index.html")) a.classList.add("active");
    nav.appendChild(a);
  });
  document.body.appendChild(nav);
}

function startFooter() {
  document.querySelectorAll("[data-annee]").forEach((e) => (e.textContent = new Date().getFullYear()));
  hydrateFooter();
  const payEl = document.getElementById("footer-pay");
  if (payEl) {
    api("/api/payment-methods")
      .then((d) => {
        if (!d.methodes || !d.methodes.length) return;
        payEl.innerHTML = "";
        for (const m of d.methodes.slice(0, 5)) {
          const b = logoOperateur(m.code, m.nom);
          b.style.background = "#f3f4f6";
          b.style.color = "#374151";
          b.title = m.nom;
          payEl.appendChild(b);
        }
      })
      .catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  startFooter();
  initLangToggle();
  initBottomNav();
  envoyerVisite();
});

const I18N = {
  fr: {
    "nav-home": "Accueil", "nav-forfaits": "Forfaits", "nav-commandes": "Commandes",
    "nav-statut": "Statut réseau", "nav-contact": "Contact", "nav-commander": "Commander",
    "pwa-title": "Installer l'application Starlink"
  },
  en: {
    "nav-home": "Home", "nav-forfaits": "Packages", "nav-commandes": "Orders",
    "nav-statut": "Status", "nav-contact": "Contact", "nav-commander": "Order",
    "pwa-title": "Install the Starlink App"
  }
};

function estLangueEN() {
  try { return (localStorage.getItem("starnet_lang") || "fr") === "en"; } catch (_) { return false; }
}

function appliquerLangue() {
  const en = estLangueEN();
  const t = en ? I18N.en : I18N.fr;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t[key] || I18N.fr[key];
    if (val) el.textContent = val;
  });
  document.querySelectorAll("[data-lang-label]").forEach((l) => { l.textContent = en ? "FR" : "EN"; });
}

function initLangToggle() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      try { localStorage.setItem("starnet_lang", estLangueEN() ? "fr" : "en"); } catch (_) {}
      appliquerLangue();
    });
  });
  appliquerLangue();
}

/* ========== PWA install (same UI banner) ========== */

function pwaMemo() {
  try { return JSON.parse(localStorage.getItem("starnet_pwa") || "{}"); }
  catch (_) { return {}; }
}
function pwaSave(patch) {
  try {
    const cur = pwaMemo();
    localStorage.setItem("starnet_pwa", JSON.stringify(Object.assign(cur, patch)));
  } catch (_) {}
}
function basculerBanniere(visible) {
  const el = document.getElementById("pwa-banner");
  if (el) el.classList.toggle("hidden", !visible);
}
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

const SVG_LOGO_SATELLITE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="36" height="36">' +
  '<circle cx="100" cy="100" r="100" fill="#000"></circle>' +
  '<ellipse cx="100" cy="100" rx="74" ry="55" stroke="white" stroke-width="10" fill="none" transform="rotate(-25 100 100)"></ellipse>' +
  '<ellipse cx="100" cy="100" rx="43" ry="33" stroke="white" stroke-width="10" fill="none" transform="rotate(65 100 100)"></ellipse>' +
  '<circle cx="100" cy="100" r="12" fill="white"></circle></svg>';

function creerBannierePWA(title) {
  let el = document.getElementById("pwa-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "pwa-banner";
    document.body.prepend(el);
  }
  el.className = "pwa-banner";
  el.classList.remove("hidden");
  const isEn = String(title).indexOf("Install") === 0;
  el.innerHTML =
    '<span class="pwa-logo">' + SVG_LOGO_SATELLITE + "</span>" +
    '<span class="pwa-text"><b>' + title + "</b>" +
    "<small>" + (isEn ? "Quick access to packages" : "Accès rapide aux forfaits") + "</small></span>" +
    '<span class="pwa-actions">' +
    '<button type="button" class="pwa-install" id="pwa-install">' + (isEn ? "Install" : "Installer") + "</button>" +
    '<button type="button" class="pwa-close" id="pwa-close" aria-label="Close">✕</button></span>';
  return el;
}

let deferredPrompt = null;

function wireInstallButton() {
  const btn = document.getElementById("pwa-install");
  if (!btn) return;
  btn.onclick = async () => {
    if (!deferredPrompt) {
      toast(estLangueEN() ? "Use browser menu → Install app" : "Menu du navigateur → Installer l'application");
      return;
    }
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") pwaSave({ installed: true });
    } catch (_) {}
    deferredPrompt = null;
    basculerBanniere(false);
  };
  const close = document.getElementById("pwa-close");
  if (close) {
    close.onclick = () => {
      pwaSave({ dismissed: Date.now() });
      basculerBanniere(false);
    };
  }
}

function showInstallBannerIfAllowed() {
  if (isStandalone()) return;
  const m = pwaMemo();
  if (m.installed) return;
  const dismissed7j = m.dismissed && Date.now() - m.dismissed < 7 * 24 * 3600 * 1000;
  if (dismissed7j && getParam("pwa") !== "1") return;
  const langEn = estLangueEN();
  creerBannierePWA(langEn ? "Install the Starlink App" : "Installer l'application Starlink");
  wireInstallButton();
}

function initPwa() {
  // Already installed as app → no banner
  if (isStandalone()) {
    pwaSave({ installed: true });
    return;
  }

  // Register service worker (required for installability)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Update when new SW found
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((e) => console.warn("SW:", e.message));
  }

  // Chrome / Edge / Android: capture install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBannerIfAllowed();
  });

  window.addEventListener("appinstalled", () => {
    pwaSave({ installed: true });
    deferredPrompt = null;
    basculerBanniere(false);
    toast(estLangueEN() ? "App installed!" : "Application installée !", "success");
  });

  // Force banner for testing: ?pwa=1
  if (getParam("pwa") === "1") {
    showInstallBannerIfAllowed();
  }

  // iOS Safari: cannot use beforeinstallprompt — show tip
  if (/iphone|ipad|ipod/i.test(navigator.userAgent || "")) {
    const m = pwaMemo();
    if (!m.installed && !(m.dismissed && Date.now() - m.dismissed < 7 * 24 * 3600 * 1000)) {
      setTimeout(() => {
        if (isStandalone()) return;
        creerBannierePWA("Installer l'application Starlink");
        const btn = document.getElementById("pwa-install");
        if (btn) {
          btn.textContent = "Compris";
          btn.onclick = () => {
            pwaSave({ dismissed: Date.now() });
            basculerBanniere(false);
            toast("Partager → Sur l'écran d'accueil");
          };
        }
        const close = document.getElementById("pwa-close");
        if (close) {
          close.onclick = () => {
            pwaSave({ dismissed: Date.now() });
            basculerBanniere(false);
          };
        }
      }, 1500);
    }
  }
}

document.addEventListener("DOMContentLoaded", initPwa);
