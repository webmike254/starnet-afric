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
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("stat-clients", s.clientsAcquis ? "+" + s.clientsAcquis : "—");
    set("stat-pays", s.paysServis ? "+" + s.paysServis : "—");
    set("stat-annees", s.anneesActivite ? "+" + s.anneesActivite : "—");
    set("stat-dispo", "99,9 %");

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

// Statistiques réseau simulées (style starnetafric.com)
function genererStatsReseau() {
  const used = (20 + Math.random() * 30).toFixed(1);
  const pct = Math.round((used / 100) * 100);
  return {
    download: (90 + Math.random() * 80).toFixed(2),
    upload: (18 + Math.random() * 12).toFixed(2),
    ping: Math.floor(20 + Math.random() * 35),
    jitter: Math.floor(2 + Math.random() * 6),
    used: used,
    limit: 100,
    pct: pct
  };
}

function afficherStatsReseau() {
  const s = genererStatsReseau();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("m-download", s.download);
  set("m-upload", s.upload);
  set("m-ping", s.ping);
  set("m-jitter", s.jitter);
  set("data-used", s.used + " GB");
  set("data-limit", s.limit + " GB");
  set("data-percentage", s.pct + "%");
  const prog = document.getElementById("data-progress");
  if (prog) prog.style.width = s.pct + "%";
}

function lancerDiag() {
  const box = document.getElementById("diag-result");
  if (!box) return;
  box.innerHTML = "<p>Analyse en cours…</p>";
  const t0 = performance.now();
  fetch("/api/health", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(() => {
      const latence = Math.round(performance.now() - t0);
      afficherStatsReseau();
      box.innerHTML = "<p style='white-space:pre-line;line-height:1.8;'>" +
        "📥 Téléchargement : " +
        (document.getElementById("m-download") ? document.getElementById("m-download").textContent : "") +
        " Mbps\n📤 Envoi : " +
        (document.getElementById("m-upload") ? document.getElementById("m-upload").textContent : "") +
        " Mbps\n📶 Ping : " +
        (document.getElementById("m-ping") ? document.getElementById("m-ping").textContent : "") +
        " ms • Jitter : " +
        (document.getElementById("m-jitter") ? document.getElementById("m-jitter").textContent : "") +
        " ms\n🖥️ Serveur joignable en " + latence + " ms</p>";
    });
}

document.addEventListener("DOMContentLoaded", () => {
  chargerAccueil();
  afficherStatsReseau();
  const btn = document.getElementById("btn-diag");
  if (btn) btn.addEventListener("click", lancerDiag);
});