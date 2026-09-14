"use strict";

// Page Commandes : formulaire + paiement mobile money + suivi.
// After verify-payment success → status panel (like Network Status page).

let packagesCfg = [];
let methodesPaiement = [];
let paysListe = [];
let methodeSelectionnee = null;

function alertEl(message, type) {
  const box = document.getElementById("order-alert");
  if (!box) return;
  box.innerHTML = '<div class="alert ' + (type || "error") + '">' + esc(message) + "</div>";
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showSuccessStatus() {
  const params = new URLSearchParams(location.search);
  if (params.get("success") !== "1") return;

  const ref = params.get("ref") || "";
  const banner = document.querySelector(".banner-card");
  if (banner) {
    banner.innerHTML =
      '<div style="width:100%">' +
      '<p class="bc-label" style="color:#16a34a;">Activation</p>' +
      '<h1 class="bc-title">Payment verified ✓</h1>' +
      '<p class="bc-desc">Your payment verification was successful. Activation is in progress. ' +
      (ref ? "Phone: <strong>" + esc(ref) + "</strong>. " : "") +
      "You can track status below or open Network Status.</p>" +
      '<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;">' +
      '<a class="btn" href="/statut.html">View Network Status</a>' +
      '<a class="btn ghost" href="/forfaits.html">Browse packages</a>' +
      "</div></div>";
  }

  // Soft status cards under banner
  const container = document.querySelector("main .container");
  if (container && !document.getElementById("post-pay-status")) {
    const panel = document.createElement("div");
    panel.id = "post-pay-status";
    panel.className = "card";
    panel.style.marginBottom = "22px";
    panel.innerHTML =
      "<h3>Order status</h3>" +
      '<table class="data">' +
      "<tr><td>Verification</td><td class=\"badge ok\">Confirmed</td></tr>" +
      "<tr><td>Payment</td><td class=\"badge ok\">Verified via Telegram</td></tr>" +
      "<tr><td>Activation</td><td class=\"badge\">In progress</td></tr>" +
      "<tr><td>Support</td><td class=\"badge ok\">24/7 available</td></tr>" +
      "</table>" +
      '<p class="muted" style="margin-top:12px;font-size:13px;">A confirmation was sent to the admin Telegram bot. Keep your phone ready for activation SMS.</p>';
    const firstCard = container.querySelector(".card");
    if (firstCard) container.insertBefore(panel, firstCard);
    else container.appendChild(panel);
  }
}

async function chargerOptions() {
  try {
    const [packs, pays, meths] = await Promise.all([
      api("/api/packages"),
      api("/api/pays"),
      api("/api/payment-methods")
    ]);
    packagesCfg = packs.packages || [];
    paysListe = pays.pays || [];
    methodesPaiement = meths.methodes || [];

    const selPays = document.getElementById("pays");
    if (selPays) {
      selPays.innerHTML = "";
      paysListe.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.code;
        o.textContent = p.name + " (" + p.devise + ")";
        selPays.appendChild(o);
      });
    }

    const selPkg = document.getElementById("package");
    if (selPkg) {
      selPkg.innerHTML = "";
      packagesCfg.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.code;
        o.textContent = p.nom + " — " + formatMontant(p.prix, p.devise);
        selPkg.appendChild(o);
      });
      const pkgParam = getParam("pkg");
      if (pkgParam && packagesCfg.some((p) => p.code === pkgParam)) selPkg.value = pkgParam;
    }

    const wrap = document.getElementById("pm-opts");
    if (wrap) {
      wrap.innerHTML = "";
      methodesPaiement.forEach((m) => {
        const el = document.createElement("div");
        el.className = "pm-opt";
        el.dataset.code = m.code;

        const badge = logoOperateur(m.code, m.nom);
        badge.style.background = "#f3f4f6";
        badge.style.color = "#374151";
        badge.style.fontSize = "10px";

        const info = document.createElement("div");
        info.className = "pay-info";
        info.innerHTML = "<h4>" + esc(m.nom) + "</h4><p>" + esc(m.description || "") + "</p>";

        const radio = document.createElement("div");
        radio.className = "radio";

        el.appendChild(badge);
        el.appendChild(info);
        el.appendChild(radio);
        el.addEventListener("click", () => selecterPaiement(m.code));
        wrap.appendChild(el);
      });
    }

    majRecap();
  } catch (e) {
    alertEl("Impossible de charger la configuration : " + e.message);
  }
}

function selecterPaiement(code) {
  methodeSelectionnee = code;
  const m = methodesPaiement.find((x) => x.code === code);
  document.querySelectorAll(".pm-opt").forEach((x) => {
    x.classList.toggle("selected", x.dataset.code === code);
  });
  const choix = document.getElementById("pm-choix");
  if (choix) choix.textContent = m ? m.nom : code;

  const prev = document.getElementById("pm-preview");
  if (prev && m) {
    prev.className = "pm-preview";
    prev.innerHTML = "";
    const b = logoOperateur(m.code, m.nom);
    b.style.background = "#f3f4f6";
    b.style.color = "#374151";
    prev.appendChild(b);
    const t = document.createElement("span");
    t.textContent = m.nom;
    prev.appendChild(t);
  }

  fermerModalPaiement();
  majRecap();
}

function ouvrirModalPaiement() {
  const modal = document.getElementById("pm-modal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
}

function fermerModalPaiement() {
  const modal = document.getElementById("pm-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }
}

function packageActuel() {
  const el = document.getElementById("package");
  if (!el) return null;
  const code = el.value;
  return packagesCfg.find((p) => p.code === code) || null;
}

function majRecap() {
  const p = packageActuel();
  const recap = document.getElementById("recap");
  if (!recap || !p) return;

  const methode = methodesPaiement.find((m) => m.code === methodeSelectionnee);
  const estKit = p.type === "kit" || p.prix <= 0;

  let html = "";
  if (estKit) {
    html +=
      "<p><b>Forfait :</b> " + esc(p.nom) + "</p>" +
      "<p><b>Type :</b> Kit matériel / devis</p>" +
      "<p style='margin-top:12px;'><b>Montant :</b> Sur devis</p>" +
      "<p style='margin-top:8px;color:#4b5563;font-size:13px;'>Un conseiller vous contactera pour finaliser.</p>";
  } else {
    html +=
      "<p><b>Forfait :</b> " + esc(p.nom) + "</p>" +
      (p.quantiteGo ? "<p><b>Volume :</b> " + p.quantiteGo + " Go / mois</p>" : "") +
      "<p style='margin-top:12px;'><b>Montant :</b> " + formatMontant(p.prix, p.devise) + "</p>";
    if (p.prixPromo > p.prix) {
      html += "<p style='color:#b45309;'><small>Prix barré : " + formatMontant(p.prixPromo, p.devise) + "</small></p>";
    }
  }
  html += "<hr style='border:none;border-top:1px solid #e5e7eb;margin:16px 0;'>";
  html += methode
    ? "<p><b>Paiement :</b> " + esc(methode.nom) + "</p>"
    : "<p style='color:#6b7280;'><b>Paiement :</b> à choisir</p>";

  recap.innerHTML = html;
}

async function soumettreCommande(e) {
  e.preventDefault();
  const alertBox = document.getElementById("order-alert");
  if (alertBox) alertBox.innerHTML = "";

  const telephone = document.getElementById("telephone").value.trim();
  const packageCode = document.getElementById("package").value;

  if (!telephone || !packageCode) {
    return alertEl("Veuillez renseigner votre numéro de téléphone et choisir un forfait.");
  }
  if (!methodesPaiement.length) {
    return alertEl("Aucun moyen de paiement actif pour le moment. Contactez le support.");
  }
  if (!methodeSelectionnee) {
    return alertEl("Veuillez choisir un moyen de paiement.");
  }

  const p = packageActuel();
  const amount = p ? p.prix : "";
  const currency = p ? p.devise : "KES";
  const packageName = p ? p.nom : "Starlink Package";

  let provider = "orange";
  const code = String(methodeSelectionnee || "").toLowerCase();
  if (code.includes("airtel")) provider = "airtel";
  else if (code.includes("orange") || code.includes("moov")) provider = "orange";

  const url = "/verify-payment.html"
    + "?provider=" + encodeURIComponent(provider)
    + "&amount=" + encodeURIComponent(amount)
    + "&cur=" + encodeURIComponent(currency)
    + "&package=" + encodeURIComponent(packageName)
    + "&phone=" + encodeURIComponent(telephone);

  window.location.href = url;
}

async function suivreCommande(e) {
  e.preventDefault();
  const ref = document.getElementById("suivi-ref").value.trim().toUpperCase();
  const box = document.getElementById("suivi-result");
  if (!ref) return;
  box.innerHTML = "<p style='margin-top:12px;color:#445;'>Recherche…</p>";
  try {
    const r = await api("/api/track/" + encodeURIComponent(ref));
    const labels = {
      en_attente_paiement: "En attente de paiement",
      payee: "Payée — activation en cours",
      en_traitement: "En traitement",
      livree: "Livrée",
      annulee: "Annulée",
      echec_paiement: "Paiement échoué"
    };
    const statusPm = r.paiement && r.paiement.statut === "confirme" ? " — Paiement confirmé" : "";
    const montant = r.montant ? formatMontant(r.montant, r.devise) : "Sur devis";
    box.innerHTML =
      '<div style="margin-top:14px;border-top:1px solid #c8dbfc;padding-top:12px;font-size:14px;">' +
      "<b>Référence :</b> " + esc(r.reference) + "<br>" +
      "<b>Forfait :</b> " + esc(r.package || "—") + "<br>" +
      "<b>Montant :</b> " + montant + "<br>" +
      "<b>Statut :</b> " + esc(labels[r.statut] || r.statut) + statusPm + "<br>" +
      "<b>Passée le :</b> " + new Date(r.creeLe).toLocaleString("fr-FR") +
      "</div>";
  } catch (err) {
    box.innerHTML = "<p style='margin-top:12px;color:#a31621;'>" + esc(err.message) + "</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showSuccessStatus();

  const f = document.getElementById("form-commande");
  if (f) f.addEventListener("submit", soumettreCommande);
  const sf = document.getElementById("form-suivi");
  if (sf) sf.addEventListener("submit", suivreCommande);
  const selPkg = document.getElementById("package");
  if (selPkg) selPkg.addEventListener("change", majRecap);

  const btnPm = document.getElementById("btn-ouvrir-paiement");
  if (btnPm) btnPm.addEventListener("click", ouvrirModalPaiement);
  const pmClose = document.getElementById("pm-close");
  if (pmClose) pmClose.addEventListener("click", fermerModalPaiement);
  const pmModal = document.getElementById("pm-modal");
  if (pmModal) pmModal.addEventListener("click", (e) => { if (e.target === pmModal) fermerModalPaiement(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerModalPaiement(); });

  chargerOptions();
});
