"use strict";

// Page Forfaits : affichage des packages gérés depuis l'administration.

let packages = [];
let filtreActif = "tout";

function carteForfait(p) {
  const card = document.createElement("div");
  card.className = "card package-card";
  if (p.populaire) {
    const badge = document.createElement("span");
    badge.className = "pkg-badge";
    badge.textContent = "Populaire";
    card.appendChild(badge);
  }

  const typeLabel = p.type === "kit" ? "Kit matériel" : "Forfait";
  const t = document.createElement("span");
  t.className = "tag";
  t.textContent = typeLabel;
  card.appendChild(t);

  const h3 = document.createElement("h3");
  h3.textContent = p.nom;
  card.appendChild(h3);

  if (p.quantiteGo) {
    const go = document.createElement("p");
    go.className = "pkg-go";
    go.style.margin = "0";
    go.textContent = p.quantiteGo + " Go / mois";
    card.appendChild(go);
  }

  if (p.description) {
    const desc = document.createElement("p");
    desc.style.margin = "6px 0 14px";
    desc.textContent = p.description;
    card.appendChild(desc);
  }

  const row = document.createElement("div");
  row.className = "price-row";
  if (p.prix > 0) {
    row.innerHTML =
      (p.prixPromo > p.prix ? '<span class="old">' + formatMontant(p.prixPromo, p.devise) + "</span>" : "") +
      "<b>" + formatMontant(p.prix, p.devise) + "</b>" +
      (p.prixPromo > p.prix ? ' <span class="promo-tag">PROMO</span>' : "") +
      (p.type !== "kit" ? ' <span class="unit">/mois</span>' : "");
  } else {
    row.innerHTML = "<b>Sur devis</b>";
  }
  card.appendChild(row);

  if (p.note) {
    const n = document.createElement("p");
    n.style.margin = "6px 0 0";
    n.style.fontSize = "12.5px";
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
    s.textContent = tag;
    tags.appendChild(s);
  });
  card.appendChild(tags);

  const a = document.createElement("a");
  a.href = "/commandes.html?pkg=" + encodeURIComponent(p.code);
  a.className = "btn";
  a.style.marginTop = "14px";
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
  const liste = packages.filter((p) => filtreActif === "tout" || p.type === filtreActif);
  if (!liste.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;color:#64748b;">Aucun forfait ne correspond à ce filtre.</p>';
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