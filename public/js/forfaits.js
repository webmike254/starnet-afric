"use strict";

// Page Forfaits : affichage des packages gérés depuis l'administration.

let packages = [];
let filtreActif = "tout";

// Couleurs par forfait (style starnetafric.com)
const COULEURS = {
  vert: { bg: "#dcfce7", ic: "#16a34a", icon: "📶" },
  bleu: { bg: "#dbeafe", ic: "#2563eb", icon: "⚡" },
  violet: { bg: "#f3e8ff", ic: "#9333ea", icon: "🚀" },
  indigo: { bg: "#e0e7ff", ic: "#4f46e5", icon: "🛡️" },
  cyan: { bg: "#cffafe", ic: "#0891b2", icon: "☁️" },
  gris: { bg: "#f3f4f6", ic: "#4b5563", icon: "🏢" },
  orange: { bg: "#ffedd5", ic: "#ea580c", icon: "⭐" }
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

  // Ligne principale : icône + nom + prix
  const row = document.createElement("div");
  row.className = "pkg-card-row";

  const left = document.createElement("div");
  left.className = "pkg-left";
  const icon = document.createElement("div");
  icon.className = "pkg-icon";
  icon.style.background = col.bg;
  icon.textContent = col.icon;
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
  hint.textContent = "1) Cliquez sur un forfait  2) Choisissez un opérateur Mobile Money";
  card.appendChild(hint);

  const a = document.createElement("a");
  a.href = "/commandes.html?pkg=" + encodeURIComponent(p.code);
  a.className = "btn";
  a.style.width = "100%";
  a.style.marginTop = "10px";
  a.textContent = p.type === "kit" ? "Demander un devis" : "Commander";
  card.appendChild(a);
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
    return p.periode === filtreActif; // 2mois / 3mois
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
});