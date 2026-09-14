"use strict";

// Page Forfaits — packages + Airtel / Orange payment overlay → verify-payment

let packages = [];
let selectedPkg = null;

const SVG_ICONS = {
  signal: '<path d="M4 20h16"/><path d="M6 16l3-3"/><path d="M10 12l4-4"/><path d="M14 8l4-4"/>',
  bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'
};

const COULEURS = {
  vert: { bg: "#dcfce7", ic: "#16a34a", icon: "signal" },
  bleu: { bg: "#dbeafe", ic: "#2563eb", icon: "bolt" },
  violet: { bg: "#f3e8ff", ic: "#9333ea", icon: "rocket" },
  indigo: { bg: "#e0e7ff", ic: "#4f46e5", icon: "shield" },
  gris: { bg: "#f3f4f6", ic: "#4b5563", icon: "building" }
};

function iconeSvg(key, color) {
  return (
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="' +
    color +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    (SVG_ICONS[key] || SVG_ICONS.bolt) +
    "</svg>"
  );
}

function couleurForfait(p) {
  return COULEURS[p.couleur] || COULEURS.bleu;
}

function ensurePayModal() {
  if (document.getElementById("pay-method-modal")) return;
  const modal = document.createElement("div");
  modal.id = "pay-method-modal";
  modal.setAttribute("aria-hidden", "true");
  // Airtel + Orange only (no Moov)
  modal.innerHTML =
    '<div class="pay-modal-backdrop"></div>' +
    '<div class="pay-modal-card" role="dialog" aria-labelledby="pay-modal-title">' +
    '  <h2 id="pay-modal-title">Choisissez votre mode de paiement</h2>' +
    '  <p class="pay-modal-sub">Comment souhaitez-vous payer ?</p>' +
    '  <button type="button" class="pay-opt" data-provider="airtel">' +
    '    <span class="pay-logo pay-logo-airtel">airtel</span>' +
    '    <span class="pay-opt-text"><strong>Airtel Money</strong><small>Payez avec votre portefeuille Airtel</small></span>' +
    '    <span class="pay-chevron">›</span>' +
    "  </button>" +
    '  <button type="button" class="pay-opt" data-provider="orange">' +
    '    <span class="pay-logo pay-logo-orange">Orange</span>' +
    '    <span class="pay-opt-text"><strong>Orange Money</strong><small>Payez avec Orange Money</small></span>' +
    '    <span class="pay-chevron">›</span>' +
    "  </button>" +
    '  <button type="button" class="pay-modal-cancel" id="pay-modal-cancel">Annuler</button>' +
    "</div>";
  document.body.appendChild(modal);

  if (!document.getElementById("pay-modal-style")) {
    const st = document.createElement("style");
    st.id = "pay-modal-style";
    st.textContent =
      "#pay-method-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;}" +
      "#pay-method-modal.open{display:flex;}" +
      ".pay-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);}" +
      ".pay-modal-card{position:relative;background:#fff;border-radius:16px;padding:28px 22px 20px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.3);}" +
      ".pay-modal-card h2{margin:0;font-size:18px;font-weight:700;color:#1f2937;text-align:center;}" +
      ".pay-modal-sub{margin:6px 0 20px;font-size:14px;color:#6b7280;text-align:center;}" +
      ".pay-opt{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;margin-bottom:12px;border:2px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s;}" +
      ".pay-opt:hover{border-color:#d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.08);}" +
      ".pay-opt[data-provider=airtel]:hover{border-color:#ed1c24;background:#fef2f2;}" +
      ".pay-opt[data-provider=orange]:hover{border-color:#FF6600;background:#fff5eb;}" +
      ".pay-logo{flex-shrink:0;width:50px;height:50px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;}" +
      ".pay-logo-airtel{background:#ed1c24;}" +
      ".pay-logo-orange{background:#FF6600;}" +
      ".pay-opt-text{flex:1;display:flex;flex-direction:column;gap:2px;}" +
      ".pay-opt-text strong{font-size:16px;color:#1f2937;}" +
      ".pay-opt-text small{font-size:12px;color:#6b7280;}" +
      ".pay-chevron{font-size:20px;color:#9ca3af;}" +
      ".pay-modal-cancel{width:100%;margin-top:4px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:transparent;font-size:14px;color:#6b7280;cursor:pointer;}" +
      ".pay-modal-cancel:hover{background:#f3f4f6;}";
    document.head.appendChild(st);
  }

  modal.querySelector(".pay-modal-backdrop").addEventListener("click", closePayModal);
  document.getElementById("pay-modal-cancel").addEventListener("click", closePayModal);
  modal.querySelectorAll(".pay-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.getAttribute("data-provider");
      goToVerify(provider);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePayModal();
  });
}

function openPayModal(pkg) {
  selectedPkg = pkg;
  ensurePayModal();
  const modal = document.getElementById("pay-method-modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePayModal() {
  const modal = document.getElementById("pay-method-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function goToVerify(provider) {
  if (!selectedPkg) return;
  const p = selectedPkg;
  const amount = p.prix > 0 ? p.prix : "";
  const currency = p.devise || "CDF";
  const packageName = p.nom || "Starlink";
  // Brief loading feel then redirect to Airtel / Orange page
  closePayModal();
  const url =
    "/verify-payment.html" +
    "?provider=" + encodeURIComponent(provider) +
    "&amount=" + encodeURIComponent(amount) +
    "&cur=" + encodeURIComponent(currency) +
    "&package=" + encodeURIComponent(packageName) +
    "&pkg=" + encodeURIComponent(p.code || "");
  window.location.href = url;
}

function carteForfait(p) {
  const col = couleurForfait(p);
  const card = document.createElement("div");
  card.className = "fp-card";
  card.addEventListener("click", (e) => {
    if (e.target.closest(".fp-btn")) return;
    if (p.prix > 0) openPayModal(p);
  });

  const top = document.createElement("div");
  top.className = "fp-top";

  const left = document.createElement("div");
  left.className = "fp-left";
  const icon = document.createElement("div");
  icon.className = "fp-icon";
  icon.style.background = col.bg;
  icon.innerHTML = iconeSvg(col.icon, col.ic);
  const txt = document.createElement("div");
  const name = document.createElement("p");
  name.className = "fp-name";
  name.textContent = p.nom;
  const data = document.createElement("p");
  data.className = "fp-data";
  data.textContent = p.quantiteGo ? p.quantiteGo + " Go /mois" : "Données illimitées";
  txt.appendChild(name);
  txt.appendChild(data);
  left.appendChild(icon);
  left.appendChild(txt);

  const right = document.createElement("div");
  right.className = "fp-price-box";
  if (p.prixPromo > p.prix) {
    const old = document.createElement("span");
    old.className = "fp-old";
    old.textContent = formatMontant(p.prixPromo, p.devise);
    right.appendChild(old);
  }
  const price = document.createElement("div");
  price.className = "fp-price";
  price.style.color = col.ic;
  price.innerHTML =
    formatMontant(p.prix, p.devise) +
    (p.prixPromo > p.prix ? ' <span class="fp-promo">PROMO</span>' : "");
  right.appendChild(price);
  const unit = document.createElement("div");
  unit.className = "fp-unit";
  unit.textContent = "/mois";
  right.appendChild(unit);

  top.appendChild(left);
  top.appendChild(right);
  card.appendChild(top);

  if (p.tags && p.tags.length) {
    const tags = document.createElement("div");
    tags.className = "fp-tags";
    p.tags.forEach((t) => {
      const s = document.createElement("span");
      s.className = "fp-tag";
      s.style.background = col.bg;
      s.style.color = col.ic;
      s.textContent = t;
      tags.appendChild(s);
    });
    card.appendChild(tags);
  }

  const hint = document.createElement("p");
  hint.className = "fp-hint";
  hint.textContent = "1) Cliquez sur un forfait  2) Choisissez Airtel ou Orange Money";
  card.appendChild(hint);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fp-btn";
  btn.textContent = "Configurer";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPayModal(p);
  });
  card.appendChild(btn);

  return card;
}

function rendu() {
  const grid = document.getElementById("grille-forfaits");
  if (!grid) return;
  grid.innerHTML = "";
  const liste = packages.filter((p) => p.actif !== false && p.type !== "kit");
  if (!liste.length) {
    grid.innerHTML = '<p style="text-align:center;color:#6b7280;">Aucun forfait disponible.</p>';
    return;
  }
  liste.forEach((p) => grid.appendChild(carteForfait(p)));
}

async function chargerForfaits() {
  try {
    const d = await api("/api/packages");
    packages = d.packages || [];
    if (!packages.length) {
      document.getElementById("grille-forfaits").innerHTML =
        '<p style="text-align:center;color:#6b7280;">Aucun forfait publié pour le moment.</p>';
      return;
    }
    rendu();
  } catch (e) {
    document.getElementById("grille-forfaits").innerHTML =
      '<p style="text-align:center;color:#a31621;">Impossible de charger les forfaits : ' +
      esc(e.message) +
      "</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  chargerForfaits();
  ensurePayModal();
});
