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
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Logo texte des opérateurs (remplaçable par les fichiers officiels dans /assets/logos/<code>.png)
function logoOperateur(code, nom) {
  const el = document.createElement("div");
  el.className = "pay-badge";
  el.textContent = nom || code;
  el.dataset.code = code;
  return el;
}

// Remplit les infos du pied de page depuis la configuration (si présentes)
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
  } catch (_) { /* silencieux */ }
}

// Initialisation de la navigation (burger mobile + lien actif)
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
          b.style.background = m.couleur || "#334155";
          b.style.color = m.texteCouleur || "#fff";
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
});