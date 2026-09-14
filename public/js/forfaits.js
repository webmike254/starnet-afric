"use strict";

// Page Forfaits : packages + payment method overlay (Airtel / Orange)

let packages = [];
let filtreActif = "tout";
let selectedPkg = null;

const SVG_ICONS = {
  signal: '<path d="M4 20h16"/><path d="M6 16l3-3"/><path d="M10 12l4-4"/><path d="M14 8l4-4"/>',
  bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.8A7 7 0 1 0 4 14.9"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
};

function iconeSvg(key, color) {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="' + color +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    (SVG_ICONS[key] || SVG_ICONS.bolt) + "</svg>";
}

const COULEURS = {
  vert: { bg: "#dcfce7", ic: "#16a34a", icon: "signal" },
  bleu: { bg: "#dbeafe", ic: "#2563eb", icon: "bolt" },
  violet: { bg: "#f3e8ff", ic: "#9333ea", icon: "rocket" },
  indigo: { bg: "#e0e7ff", ic: "#4f46e5", icon: "shield" },
  cyan: { bg: "#cffafe", ic: "#0891b2", icon: "cloud" },
  gris: { bg: "#f3f4f6", ic: "#4b5563", icon: "building" },
  orange: { bg: "#ffedd5", ic: "#ea580c", icon: "star" }
};
function couleurForfait(p) {
  return COULEURS[p.couleur] || COULEURS.bleu;
}

const PERIODES = { mois: "/mois", "2mois": "/2 mois", "3mois": "/3 mois" };

function libelleDonnees(p) {
  if (p.type === "kit") return "Kit matériel";
  if (!p.quantiteGo) return "Données illimitées";
  const g = p.quantiteGo;
  const q = g >= 1000 ? (g / 1000) + " TB" : g + " Go";
  return q + " " + (p.periode === "mois" ? "/ mois" : PERIODES[p.periode] || "/ mois");
}

function libellePeriode(p) {
  if (p.type === "kit") return "Une fois";
  return PERIODES[p.periode] || "/mois";
}

function ensurePayModal() {
  if (document.getElementById("pay-method-modal")) return;
  const modal = document.createElement("div");
  modal.id = "pay-method-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML =
    '<div class="pay-modal-backdrop"></div>' +
    '<div class="pay-modal-card" role="dialog" aria-labelledby="pay-modal-title">' +
    '  <h2 id="pay-modal-title">Select Payment Method</h2>' +
    '  <p class="pay-modal-sub">Choose how you want to pay</p>' +
    '  <button type="button" class="pay-opt" data-provider="airtel">' +
    '    <span class="pay-logo pay-logo-airtel">airtel</span>' +
    '    <span class="pay-opt-text"><strong>Airtel Money</strong><small>Pay with your Airtel wallet</small></span>' +
    '    <span class="pay-chevron">›</span>' +
    '  </button>' +
    '  <button type="button" class="pay-opt" data-provider="orange">' +
    '    <span class="pay-logo pay-logo-orange">Orange</span>' +
    '    <span class="pay-opt-text"><strong>Orange Money</strong><small>Pay with Orange Money</small></span>' +
    '    <span class="pay-chevron">›</span>' +
    '  </button>' +
    '  <button type="button" class="pay-modal-cancel" id="pay-modal-cancel">Cancel</button>' +
    '</div>';
  document.body.appendChild(modal);

  if (!document.getElementById("pay-modal-style")) {
    const st = document.createElement("style");
    st.id = "pay-modal-style";
    st.textContent =
      "#pay-method-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;}" +
      "#pay-method-modal.open{display:flex;}" +
      ".pay-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);}" +
      ".pay-modal-card{position:relative;background:#fff;border-radius:20px;padding:28px 22px 20px;width:100%;max-width:380px;box-shadow:0 20px 50px rgba(0,0,0,.25);}" +
      ".pay-modal-card h2{margin:0;font-size:20px;font-weight:700;color:#0f172a;text-align:center;}" +
      ".pay-modal-sub{margin:6px 0 20px;font-size:14px;color:#64748b;text-align:center;}" +
      ".pay-opt{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;margin-bottom:12px;border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s;}" +
      ".pay-opt:hover{border-color:#94a3b8;box-shadow:0 4px 12px rgba(0,0,0,.06);}" +
      ".pay-logo{flex-shrink:0;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;letter-spacing:-.2px;}" +
      ".pay-logo-airtel{background:#e60000;}" +
      ".pay-logo-orange{background:#ff7900;}" +
      ".pay-opt-text{flex:1;display:flex;flex-direction:column;gap:2px;}" +
      ".pay-opt-text strong{font-size:15px;color:#0f172a;}" +
      ".pay-opt-text small{font-size:12px;color:#64748b;}" +
      ".pay-chevron{font-size:22px;color:#94a3b8;font-weight:300;}" +
      ".pay-modal-cancel{width:100%;margin-top:6px;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;font-weight:600;color:#334155;cursor:pointer;}" +
      ".pay-modal-cancel:hover{background:#f8fafc;}";
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
  const currency = p.devise || "KES";
  const packageName = p.nom || "Starlink Package";
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
  const card = document.createElement("div");
  card.className = "card package-card";
  if (p.populaire) {
    const badge = document.createElement("span");
    badge.className = "pkg-badge";
    badge.textContent = "Populaire";
    card.appendChild(badge);
  }

  const col = couleurForfait(p);
  const row = document.createElement("div");
  row.className = "pkg-card-row";

  const left = document.createElement("div");
  left.className = "pkg-left";
  const icon = document.createElement("div");
  icon.className = "pkg-icon";
  icon.style.background = col.bg;
  icon.innerHTML = iconeSvg(col.icon, col.ic);
  const txt = document.createElement("div");
  const h3 = document.createElement("h3");
  h3.textContent = p.nom;
  h3.style.fontSize = "16px";
  const data = document.createElement("p");
  data.style.margin = "2px 0 0";
  data.style.color = "#6b7280";
  data.style.fontSize = "13.5px";
  data.textContent = libelleDonnees(p);
  txt.appendChild(h3);
  txt.appendChild(data);
  left.appendChild(icon);
  left.appendChild(txt);
  row.appendChild(left);

  const right = document.createElement("div");
  right.className = "pkg-right";
  if (p.prix > 0) {
    const oldP = document.createElement("span");
    oldP.className = "old";
    if (p.prixPromo > p.prix) {
      oldP.textContent = formatMontant(p.prixPromo, p.devise);
      oldP.style.display = "block";
    } else {
      oldP.style.display = "none";
    }
    const cur = document.createElement("span");
    cur.className = "cur";
    cur.style.color = col.ic;
    cur.textContent = formatMontant(p.prix, p.devise);
    right.appendChild(oldP);
    right.appendChild(cur);
    if (p.prixPromo > p.prix) {
      const tag = document.createElement("span");
      tag.className = "promotag-red";
      tag.textContent = "PROMO";
      right.appendChild(tag);
    }
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = libellePeriode(p);
    right.appendChild(unit);
  } else {
    const cur = document.createElement("span");
    cur.className = "cur";
    cur.textContent = "Sur devis";
    right.appendChild(cur);
  }
  row.appendChild(right);
  card.appendChild(row);

  if (p.description) {
    const desc = document.createElement("p");
    desc.style.margin = "10px 0 0";
    desc.style.fontSize = "13px";
    desc.style.color = "#4b5563";
    desc.textContent = p.description;
    card.appendChild(desc);
  }

  if (p.note) {
    const n = document.createElement("p");
    n.style.margin = "8px 0 0";
    n.style.fontSize = "12px";
    n.style.color = "#b45309";
    n.textContent = p.note;
    card.appendChild(n);
  }

  const tags = document.createElement("div");
  tags.style.margin = "12px 0 0";
  (p.tags || []).forEach((tag) => {
    const s = document.createElement("span");
    s.className = "tag";
    s.style.margin = "0 6px 6px 0";
    s.style.background = col.bg;
    s.style.color = col.ic;
    s.textContent = tag;
    tags.appendChild(s);
  });
  card.appendChild(tags);

  const hint = document.createElement("p");
  hint.className = "pkg-hint";
  hint.textContent = "1) Cliquez sur un forfait  2) Choisissez Airtel ou Orange Money";
  card.appendChild(hint);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.style.width = "100%";
  btn.style.marginTop = "10px";
  btn.textContent = p.type === "kit" ? "Demander un devis" : "Commander";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (p.type === "kit" || p.prix <= 0) {
      window.location.href = "/commandes.html?pkg=" + encodeURIComponent(p.code);
      return;
    }
    openPayModal(p);
  });
  card.appendChild(btn);
  return card;
}

function filtres() {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      filtreActif = b.getAttribute("data-filtre");
      rendu();
    });
  });
}

function rendu() {
  const grid = document.getElementById("grille-forfaits");
  if (!grid) return;
  grid.innerHTML = "";
  const liste = packages.filter((p) => {
    if (filtreActif === "tout") return true;
    if (filtreActif === "mensuel") return p.type === "mensuel";
    if (filtreActif === "kit") return p.type === "kit";
    return p.periode === filtreActif;
  });
  if (!liste.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;color:#6b7280;">Aucun forfait ne correspond à ce filtre.</p>';
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
        '<p style="grid-column:1/-1;color:#64748b;">Aucun forfait publié pour le moment.</p>';
      return;
    }
    rendu();
  } catch (e) {
    document.getElementById("grille-forfaits").innerHTML =
      '<p style="grid-column:1/-1;color:#a31621;">Impossible de charger les forfaits : ' + esc(e.message) + "</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  filtres();
  chargerForfaits();
  ensurePayModal();
});
