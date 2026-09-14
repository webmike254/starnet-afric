"use strict";

/* Importants utilitaires partagés du site public. */

// Récupération d'un paramètre d'URL
function getParam(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}

// Affiche une petite notification en bas à droite
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

// Appel API unifié (JSON). Throws en cas d'erreur HTTP.
async function api(url, opts) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    ...opts,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* corps non-JSON */ }
  if (!res.ok) throw new Error(data.error || "Erreur (" + res.status + ")");
  return data;
}

// Formatage d'un montant en devise locale
function formatMontant(montant, devise) {
  if (montant == null) return "Sur devis";
  try {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant) + " " + devise;
  } catch (_) {
    return montant.toLocaleString("fr-FR") + " " + devise;
  }
}

// Rendu du choix de devise sur les logos de paiement
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}

// Logo des opérateurs — utilise les fichiers officiels dans /assets/logos/<code>.svg
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
    const els = document.querySelectorAll("[data-site]");
    for (const el of els) {
      const key = el.getAttribute("data-site");
      const val = c.site && c.site[key];
      if (val) el.textContent = val;
    }
    if (c.site && c.site.telephone && document.body) {
      const tel = document.getElementById("tel-link");
      if (tel) tel.href = "tel:" + c.site.telephone.replace(/[^+\d]/g, "");
      const wa = document.getElementById("wa-link");
      if (wa) wa.href = "https://wa.me/" + String(c.site.whatsapp || "").replace(/[^+\d]/g, "");
      const mail = document.getElementById("mail-link");
      if (mail && c.site.email) mail.href = "mailto:" + c.site.email;
    }
  } catch (_) { }
}

function initNav() {
  const burger = document.querySelector(".nav-burger");
  const links = document.querySelector(".nav-links");
  if (burger && links) {
    burger.addEventListener("click", () => links.classList.toggle("open"));
  }
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
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/visit?p=" + p);
      } else {
        fetch("/api/visit?p=" + p, { method: "GET", keepalive: true }).catch(() => {});
      }
    }
  } catch (_) { }
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
    "pwa-title": "Installer l'application Starnét"
  },
  en: {
    "nav-home": "Home", "nav-forfaits": "Packages", "nav-commandes": "Orders",
    "nav-statut": "Status", "nav-contact": "Contact", "nav-commander": "Order",
    "pwa-title": "Install the Starnét App"
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
  const btns = document.querySelectorAll(".lang-btn");
  btns.forEach((b) => { b.setAttribute("aria-label", en ? "Langue : Français" : "Language: English"); });
  const labels = document.querySelectorAll("[data-lang-label]");
  labels.forEach((l) => { l.textContent = en ? "FR" : "EN"; });
}

function initLangToggle() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      try { localStorage.setItem("starnet_lang", estLangueEN() ? "fr" : "en"); } catch (_) { }
      appliquerLangue();
    });
  });
  appliquerLangue();
}

// ============================================================
// PWA : service worker + bannière d'installation (top-only, compact)
// ============================================================

function pwaMemo() {
  try { return JSON.parse(localStorage.getItem("starnet_pwa") || "{}"); }
  catch (_) { return {}; }
}

function pwaSave(obj) {
  try { localStorage.setItem("starnet_pwa", JSON.stringify(obj)); } catch (_) { }
}

function basculerBanniere(visible) {
  const el = document.getElementById("pwa-banner");
  if (el) el.classList.toggle("hidden", !visible);
}

const SVG_LOGO_SATELLITE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="36" height="36">' +
  '<circle cx="100" cy="100" r="100" fill="#000"></circle>' +
  '<ellipse cx="100" cy="100" rx="74" ry="55" stroke="white" stroke-width="10" fill="none" transform="rotate(-25 100 100)"></ellipse>' +
  '<ellipse cx="100" cy="100" rx="43" ry="33" stroke="white" stroke-width="10" fill="none" transform="rotate(65 100 100)"></ellipse>' +
  '<circle cx="100" cy="100" r="12" fill="white"></circle></svg>';

function creerBannierePWA(i18nTitle) {
  const el = document.getElementById("pwa-banner") || document.createElement("div");
  el.id = "pwa-banner";
  el.className = "pwa-banner";
  el.innerHTML =
    '<span class="pwa-logo">' + SVG_LOGO_SATELLITE + "</span>" +
    '<span class="pwa-text">' +
    "<b>" + i18nTitle + "</b>" +
    "<small>" + (i18nTitle.indexOf("Install") === 0 ? "Quick access to packages" : "Accès rapide aux forfaits") + "</small>" +
    "</span>" +
    '<span class="pwa-actions">' +
    '<button type="button" class="pwa-install" id="pwa-install">' +
    (i18nTitle.indexOf("Install") === 0 ? "Install" : "Installer") +
    "</button>" +
    '<button type="button" class="pwa-close" id="pwa-close" aria-label="Close">✕</button>' +
    "</span>";
  if (!document.getElementById("pwa-banner")) document.body.prepend(el);
  return el;
}

function creerBanniere(html) {
  let el = document.getElementById("pwa-banner");
  if (el) return el;
  el = document.createElement("div");
  el.id = "pwa-banner";
  el.className = "pwa-banner";
  el.innerHTML = html;
  document.body.prepend(el);
  return el;
}

let deferredPrompt = null;

function initPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW:", e.message));
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const m = pwaMemo();
    const dismissed7j = m.dismissed && Date.now() - m.dismissed < 7 * 24 * 3600 * 1000;
    if (m.installed || dismissed7j) return;
    const langEn = estLangueEN();
    creerBannierePWA(langEn ? "Install the Starnét App" : "Installer l'application Starnét");
    document.getElementById("pwa-install").addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) { }
      deferredPrompt = null;
    });
    document.getElementById("pwa-close").addEventListener("click", () => {
      pwaSave({ dismissed: Date.now() });
      basculerBanniere(false);
    });
  });

  window.addEventListener("appinstalled", () => {
    pwaSave({ installed: true });
    basculerBanniere(false);
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent || "")) {
    const m = pwaMemo();
    if (m.installed) return;
    setTimeout(() => {
      creerBanniere(
        '<span class="pwa-logo">' + SVG_LOGO_SATELLITE + "</span>" +
        '<span class="pwa-text"><b>Installez Starnét Afric</b>' +
        "<small>Partager → Sur l'écran d'accueil</small></span>" +
        '<span class="pwa-actions">' +
        '<button type="button" class="pwa-install" id="pwa-ios-ok">Compris</button>' +
        "</span>"
      );
      const okBtn = document.getElementById("pwa-ios-ok");
      if (okBtn) okBtn.addEventListener("click", () => basculerBanniere(false));
    }, 1200);
  }
}

document.addEventListener("DOMContentLoaded", initPwa);
