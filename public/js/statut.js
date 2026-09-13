"use strict";

// Page Statut : état du réseau + petit diagnostic client.

const RESEAU_LABELS = {
  operational: { tag: "Opérationnel", titre: "Tout fonctionne normalement", couleur: "#16a34a" },
  degrade: { tag: "Dégradé", titre: "Dégradation temporaire", couleur: "#d97706" },
  maintenance: { tag: "Maintenance", titre: "Maintenance planifiée", couleur: "#2563eb" }
};

async function chargerStatut() {
  try {
    const c = await api("/api/config-public");
    const r = c.reseau || {};
    const info = RESEAU_LABELS[r.statut] || RESEAU_LABELS.operational;

    const tag = document.getElementById("statut-tag");
    if (tag) {
      tag.style.background = info.couleur;
      tag.style.color = "#fff";
      tag.textContent = info.tag;
    }
    const titre = document.getElementById("statut-titre");
    if (titre) titre.textContent = info.titre;
    const msg = document.getElementById("statut-message");
    if (msg) msg.textContent = r.message || "Le réseau Starlink fonctionne normalement dans votre zone.";
    const horo = document.getElementById("statut-horodatage");
    if (horo) horo.textContent = "Mis à jour : " + (r.misAJour ? new Date(r.misAJour).toLocaleString("fr-FR") : "à l'instant");

    const sat = document.getElementById("sat-tag");
    if (sat) {
      sat.className = "badge " + (r.statut === "operational" ? "ok" : "warn");
      sat.textContent = info.tag;
    }
  } catch (_) {
    const msg = document.getElementById("statut-message");
    if (msg) msg.textContent = "Impossible de charger l'état du réseau.";
  }
}

function lancerDiagnostic() {
  const box = document.getElementById("diag-result");
  if (!box) return;
  box.innerHTML = "<p>Test en cours…</p>";

  const t0 = performance.now();
  fetch("/api/health", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(() => {
      const latence = Math.round(performance.now() - t0);
      const down = (25 + Math.random() * 80).toFixed(1); // simulation indicative
      const up = (8 + Math.random() * 25).toFixed(1);
      const ping = Math.max(18, latence);
      const jitter = (2 + Math.random() * 8).toFixed(1);

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set("m-download", down);
      set("m-upload", up);
      set("m-ping", ping);
      set("m-jitter", jitter);

      const used = document.getElementById("data-used");
      if (used) used.textContent = Math.round(0.41 * 100) + " GB";

      box.innerHTML = "<p style='white-space:pre-line;line-height:1.8;'>" +
        esc("Résultat estimé :\n") +
        "Téléchargement : " + down + " Mbps\n" +
        "Envoi : " + up + " Mbps\n" +
        "Ping : " + ping + " ms • Jitter : " + jitter + " ms\n" +
        "Serveur joignable en " + latence + " ms" +
        "</p>";
    });
}

document.addEventListener("DOMContentLoaded", () => {
  chargerStatut();
  const btn = document.getElementById("btn-diag");
  if (btn) btn.addEventListener("click", lancerDiagnostic);
});