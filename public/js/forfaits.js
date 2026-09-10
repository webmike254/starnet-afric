"use strict";

// Page Forfaits : affichage des packages gérés depuis l'administration.

let packages = [];
let filtreActif = "tout";

function carteForfait(p) {
  const card = document.createElement("div");
  card.className = "card";
  if (p.populaire) {
    const badge = document.createElement("span");
    badge.className = "pkg-badge";
    badge.textContent = "Populaire";
    card.appendChild(badge);
  }

  const typeLabel = p.type === "kit" ? "Kit matériel" : "Forfait mensuel";
  const t = document.createElement("span");
  t.className = "tag";
  t.style.background = "#eef1f6";
  t.style.color = "#546070";
  t.textContent = typeLabel;
  card.appendChild(t);

  const h3 = document.createElement("h3");
  h3.textContent = p.nom;
  card.appendChild(h3);

  if (p.description) {
    const desc = document.createElement("p");
    desc.textContent = p.description;
    card.appendChild(desc);
  }

  if (p.quantiteGo) {
    const go = document.createElement("p");
    go.style.fontWeight = "800";
    go.style.color = "#1e4fd0";
    go.style.margin = "0 0 8px";
    go.textContent = p.quantiteGo + " Go / mois";
    card.appendChild(go);
  }

  const price = document.createElement("div");
  price.className = "price";
  if (p.prix > 0) {
    price.innerHTML =
      "<b>" + formatMontant(p.prix, p.devise) + "</b>" +
      (p.prixPromo > p.prix ? ' <span class="old">' + formatMontant(p.prixPromo, p.devise) + "</span>" : "") +
      (p.type !== "kit" ? ' <span class="unit">/mois</span>' : "");
  } else {
    price.innerHTML = "<b>Sur devis</b>";
  }
  card.appendChild(price);

  if (p.note) {
    const n = document.createElement("p");
    n.style.margin = "6px 0 0";
    n.style.fontSize = "12.5px";
    n.style.color = "#8a5a07";
    n.textContent = p.note;
    card.appendChild(n);
  }

  const tags = document.createElement("div");
  tags.style.marginTop = "10px";
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
  a.style.justifyContent = "center";
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