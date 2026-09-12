"use strict";

// Page d'accueil : statistiques, forfaits du moment, moyens de paiement, état du réseau.

function carteForfait(p) {
  const card = document.createElement("div");
  card.className = "card package-card";
  if (p.populaire) {
    const badge = document.createElement("span");
    badge.className = "pkg-badge";
    badge.textContent = "Populaire";
    card.appendChild(badge);
  }

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

  const desc = document.createElement("p");
  desc.style.margin = "6px 0 14px";
  desc.textContent = p.description;
  card.appendChild(desc);

  const price = document.createElement("div");
  price.className = "price-row";
  if (p.prix > 0) {
    price.innerHTML =
      (p.prixPromo > p.prix ? '<span class="old">' + formatMontant(p.prixPromo, p.devise) + "</span>" : "") +
      "<b>" + formatMontant(p.prix, p.devise) + "</b>" +
      (p.prixPromo > p.prix ? ' <span class="promo-tag">PROMO</span>' : "") +
      ' <span class="unit">/mois</span>';
  } else {
    price.innerHTML = "<b>Sur devis</b>";
  }
  card.appendChild(price);

  const tags = document.createElement("div");
  tags.style.marginTop = "12px";
  (p.tags || []).slice(0, 2).forEach((t) => {
    const s = document.createElement("span");
    s.className = "tag";
    s.style.margin = "0 6px 6px 0";
    s.textContent = t;
    tags.appendChild(s);
  });
  card.appendChild(tags);

  const a = document.createElement("a");
  a.href = "/commandes.html?pkg=" + encodeURIComponent(p.code);
  a.className = "btn";
  a.style.marginTop = "14px";
  a.textContent = "Choisir ce forfait";
  card.appendChild(a);
  return card;
}

async function chargerAccueil() {
  try {
    const config = await api("/api/config-public");
    const s = config.site || {};
    const dispo = "99,9 %";
    document.getElementById("stat-clients").textContent = s.clientsAcquis ? "+" + s.clientsAcquis : "—";
    document.getElementById("stat-pays").textContent = s.paysServis ? "🇿🇦 " + s.paysServis : "—";
    document.getElementById("stat-annees").textContent = s.anneesActivite ? "+" + s.anneesActivite : "—";
    document.getElementById("stat-dispo").textContent = dispo;

    const r = config.reseau || {};
    const bannerMsg = document.getElementById("reseau-message");
    const banner = document.getElementById("reseau-banner");
    if (bannerMsg) {
      if (r.statut === "maintenance") {
        bannerMsg.textContent = "⚠️ Maintenance planifiée : " + (r.message || "intervention en cours.");
      } else if (r.statut === "degrade") {
        bannerMsg.textContent = "🟠 Dégradation temporaire : " + (r.message || "le service reste accessible.");
      } else {
        bannerMsg.textContent = "✅ " + (r.message || "Le réseau Starlink fonctionne normalement dans votre zone.");
      }
      if (bannerMsg.parentElement) {
        const b = bannerMsg.parentElement;
        b.style.borderLeft = r.statut === "operational" ? "4px solid #16a34a" : "4px solid #d97706";
      }
    }
  } catch (_) { /* laisse les valeurs par défaut */ }

  // Forfaits du moment : populaires d'abord, puis les 3 premiers
  try {
    const d = await api("/api/packages");
    const liste = d.packages.slice().sort((a, b) => (b.populaire ? 1 : 0) - (a.populaire ? 1 : 0));
    const top = liste.slice(0, 3);
    const grid = document.getElementById("forfaits-populaires");
    if (grid && top.length) {
      grid.innerHTML = "";
      top.forEach((p) => grid.appendChild(carteForfait(p)));
    }
  } catch (_) { /* silencieux */ }

  // Moyens de paiement sur la page d'accueil
  try {
    const d = await api("/api/payment-methods");
    const strip = document.getElementById("pay-methods-home");
    if (strip && d.methodes) {
      d.methodes.forEach((m) => {
        const b = logoOperateur(m.code, m.nom);
        b.style.background = m.couleur || "#334155";
        b.style.color = m.texteCouleur || "#fff";
        b.title = m.nom;
        strip.appendChild(b);
      });
    }
  } catch (_) { /* silencieux */ }
}

document.addEventListener("DOMContentLoaded", chargerAccueil);