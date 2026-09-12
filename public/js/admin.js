"use strict";

// ============================================================
// Administration Starnét Afric — script principal
// ============================================================

const ETATS_ORDRE = {
  en_attente_paiement: ["dim", "En attente de paiement"],
  payee: ["ok", "Payée"],
  en_traitement: ["info", "En traitement"],
  livree: ["ok", "Livrée"],
  annulee: ["bad", "Annulée"],
  echec_paiement: ["bad", "Paiement échoué"]
};

function badgeStatut(statut) {
  const [cls, label] = ETATS_ORDRE[statut] || ["dim", statut || "—"];
  return '<span class="badge ' + cls + '">' + esc(label) + "</span>";
}

function badgePaiement(paiement) {
  if (!paiement) return '<span class="badge dim">Aucun</span>';
  if (paiement.statut === "confirme") return '<span class="badge ok">Confirmé</span>';
  if (paiement.statut === "en_attente") return '<span class="badge warn">En attente</span>';
  if (paiement.statut === "echec") return '<span class="badge bad">Échec</span>';
  return '<span class="badge dim">' + esc(paiement.statut) + "</span>";
}

async function adminGet(url) {
  return api("/api/admin" + url, { method: "GET" });
}

// Si une route admin répond 401, on redirige vers la page de connexion.
function guarderAdmin(err) {
  if (err && /401|Non authentifié/i.test(String(err.message || ""))) {
    window.location.href = "/admin/login.html";
    return true;
  }
  return false;
}

function clignote(btn) {
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = "✓ Enregistré";
  setTimeout(() => (btn.textContent = old), 1600);
}

// ---------- Navigation entre vues ----------
function initNavigation() {
  document.querySelectorAll("[data-view]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll("[data-view]").forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      showPane(a.getAttribute("data-view"));
    });
  });
}

function showPane(name) {
  document.querySelectorAll("[data-pane]").forEach((p) => p.classList.add("hidden"));
  const pane = document.querySelector('[data-pane="' + name + '"]');
  if (pane) pane.classList.remove("hidden");
  const loaders = {
    dashboard: chargerDashboard,
    orders: chargerCommandes,
    analytics: chargerAnalytics,
    packages: chargerForfaitsAdmin,
    customers: chargerClients,
    messages: chargerMessages,
    settings: chargerParametres
  };
  if (loaders[name]) loaders[name]();
  window.scrollTo({ top: 0 });
// ---------- Dashboard ----------
async function chargerDashboard() {
  try {
    const s = await adminGet("/summary");
    const kpis = document.getElementById("kpis");
    kpis.innerHTML = [
      ['<span>Commandes totales</span><b>' + s.totalCommandes + "</b>"],
      ['<span>Commandes aujourd&rsquo;hui</span><b>' + s.commandesAujourdhui + "</b>"],
      ['<span>En attente de paiement</span><b>' + s.enAttentePaiement + "</b>"],
      ['<span>Payées</span><b>' + s.payees + "</b>"],
      ['<span>Visites (7j)</span><b>' + (s.analytics ? s.analytics.visites7j : 0) + "</b>"],
      ['<span>Visiteurs uniques (7j)</span><b>' + (s.analytics ? s.analytics.visiteurs7j : 0) + "</b>"]
    ]
      .map((x) => '<div class="kpi">' + x.join("") + "</div>")
      .join("");

    const tab = document.getElementById("tab-dernieres");
    if (!(s.dernieresCommandes || []).length) {
      tab.innerHTML = '<tr><td class="muted">Aucune commande pour le moment.</td></tr>';
      return;
    }
    tab.innerHTML =
      "<tr><th>Réf</th><th>Client</th><th>Téléphone</th><th>Montant</th><th>Statut</th><th>Paiement</th><th>Date</th></tr>" +
      s.dernieresCommandes.map((o) =>
        "<tr>" +
        "<td class='mono'>" + esc(o.reference) + "</td>" +
        "<td>" + esc(o.nom) + "</td>" +
        "<td>" + esc(o.telephone) + "</td>" +
        "<td>" + (o.montant ? formatMontant(o.montant, o.devise) : "Devis") + "</td>" +
        "<td>" + badgeStatut(o.statut) + "</td>" +
        "<td>" + badgePaiement(o.paiement) + "</td>" +
        "<td class='muted'>" + new Date(o.creeLe).toLocaleDateString("fr-FR") + "</td>" +
        "</tr>"
      ).join("");
  } catch (e) {
    if (guarderAdmin(e)) return;
    document.getElementById("kpis").innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

// ---------- Commandes ----------
let toutesCommandes = [];

async function chargerCommandes() {
  try {
    const d = await adminGet("/orders");
    toutesCommandes = d.orders || [];
    renderCommandes();
  } catch (e) {
    if (guarderAdmin(e)) return;
    document.getElementById("tab-orders").innerHTML = '<tr><td>' + esc(e.message) + "</td></tr>";
  }
}

function renderCommandes() {
  const q = document.getElementById("q-orders").value.trim().toLowerCase();
  const st = document.getElementById("f-statut").value;
  let list = toutesCommandes;
  if (st) list = list.filter((o) => o.statut === st);
  if (q) list = list.filter((o) => [o.reference, o.nom, o.telephone, o.email].join(" ").toLowerCase().includes(q));

  const tab = document.getElementById("tab-orders");
  if (!list.length) {
    tab.innerHTML = '<tr><td class="muted">Aucune commande correspondante.</td></tr>';
    return;
  }
  tab.innerHTML =
    "<tr><th>Réf</th><th>Client</th><th>Téléphone</th><th>Forfait</th><th>Montant</th><th>Statut</th><th>Paiement</th><th>Actions</th></tr>" +
    list.map((o) =>
      "<tr>" +
      "<td class='mono'>" + esc(o.reference) + "</td>" +
      "<td>" + esc(o.nom) + "</td>" +
      "<td>" + esc(o.telephone) + "</td>" +
      "<td>" + esc(o.package ? o.package.nom : "—") + "</td>" +
      "<td>" + (o.montant ? formatMontant(o.montant, o.devise) : "Devis") + "</td>" +
      "<td>" + badgeStatut(o.statut) + "</td>" +
      "<td>" + badgePaiement(o.paiement) + "</td>" +
      "<td style='white-space:nowrap;'>" +
      '<select class="admin-input" onchange="changerStatut(\'' + esc(o.reference) + '\', this.value)" style="padding:4px 6px;font-size:12px;">' +
      '<option value="en_attente_paiement"' + (o.statut === "en_attente_paiement" ? " selected" : "") + ">En attente</option>" +
      '<option value="payee"' + (o.statut === "payee" ? " selected" : "") + ">Payée</option>" +
      '<option value="en_traitement"' + (o.statut === "en_traitement" ? " selected" : "") + ">Traitement</option>" +
      '<option value="livree"' + (o.statut === "livree" ? " selected" : "") + ">Livrée</option>" +
      '<option value="annulee"' + (o.statut === "annulee" ? " selected" : "") + ">Annulée</option>" +
      "</select>" +
      (o.paiement && o.paiement.statut !== "confirme"
        ? '<button class="btn small success" style="margin-left:6px;" onclick="confirmerPaiement(\'' + esc(o.reference) + '\')">Valider paie.</button>'
        : "") +
      "</td>" +
      "</tr>"
    ).join("");
}

async function changerStatut(ref, statut) {
  try {
    await api("/api/admin/orders/" + encodeURIComponent(ref), { method: "PATCH", body: { statut } });
    toast("Statut de " + ref + " mis à jour", "success");
    renderCommandes();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function confirmerPaiement(ref) {
  try {
    await api("/api/admin/orders/" + encodeURIComponent(ref) + "/confirm-payment", { method: "POST", body: {} });
    toast("Paiement confirmé pour " + ref, "success");
    renderCommandes();
  } catch (e) {
    toast(e.message, "error");
  }
}
// ---------- Analytique ----------
function topListe(champ, items) {
  const el = document.getElementById(champ);
  if (!items || !items.length) {
    el.innerHTML = "<p class='muted'>Pas encore de données.</p>";
    return;
  }
  const max = items[0].n || 1;
  el.innerHTML = items
    .map((i) => {
      const pct = Math.round((i.n / max) * 100);
      return (
        '<div style="margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">' +
        "<span>" + esc(i.clef) + "</span><span class='muted'>" + i.n + "</span></div>" +
        '<div style="background:#1e293b;border-radius:4px;height:8px;"><div style="width:' + pct + '%;background:#3b82f6;height:8px;border-radius:4px;"></div></div>' +
        "</div>"
      );
    })
    .join("");
}

async function chargerAnalytics() {
  try {
    const a = await adminGet("/analytics");
    const max = Math.max(1, ...a.serie14j.map((d) => d.visites));
    document.getElementById("chart-series").innerHTML = a.serie14j
      .map(
        (d) =>
          '<div class="bar" title="' + d.jour + " — " + d.visites + ' visites" style="height:' +
          Math.max(4, Math.round((d.visites / max) * 100)) + '%;"></div>'
      )
      .join("");
    document.getElementById("labels-series").innerHTML =
      '<div class="item"><label>' + (a.serie14j && a.serie14j[0] ? new Date(a.serie14j[0].jour + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "") + "</label></div>" +
      '<div class="item"><label>aujourd&rsquo;hui</label></div>';

    topListe("pages-top", a.pagesPopulaires);
    topListe("referrers-top", a.referers);
    topListe("devices-top", a.appareils);
    topListe("browsers-top", a.navigateurs);

    document.getElementById("last-visits").innerHTML = (a.derniers || [])
      .map(
        (v) =>
          '<div style="border-bottom:1px solid #263149;padding:7px 0;font-size:13px;">' +
          "<b>" + esc(v.path) + "</b> " +
          '<span class="muted">' + new Date(v.ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</span><br>" +
          '<span class="muted">' + esc(v.referrer) + " • " + esc(v.device) + " • " + esc(v.browser) + "</span>" +
          "</div>"
      )
      .join("");
  } catch (e) {
    if (guarderAdmin(e)) return;
    document.getElementById("chart-series").innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

// ---------- Forfaits (admin) ----------
let packagesAdmin = [];
async function chargerForfaitsListe() {
  const d = await adminGet("/packages");
  packagesAdmin = d.packages || [];
}

async function chargerForfaitsAdmin() {
  try {
    const d = await adminGet("/packages");
    packagesAdmin = d.packages || [];
    const tab = document.getElementById("tab-packages");
    tab.innerHTML =
      "<tr><th>Nom</th><th>Go</th><th>Prix</th><th>Devise</th><th>Type</th><th>Populaire</th><th>Active</th><th>Actions</th></tr>" +
      packagesAdmin
        .map(
          (p) =>
            "<tr>" +
            "<td>" + esc(p.nom) + "</td>" +
            "<td>" + (p.quantiteGo || "—") + "</td>" +
            "<td>" + (p.prix ? formatMontant(p.prix, p.devise) : "Devis") + "</td>" +
            "<td>" + esc(p.devise) + "</td>" +
            "<td>" + (p.type === "kit" ? "Kit" : "Mensuel") + "</td>" +
            "<td>" + (p.populaire ? "⭐" : "—") + "</td>" +
            "<td>" + (p.actif ? '<span class="badge ok">Oui</span>' : '<span class="badge bad">Non</span>') + "</td>" +
            "<td style='white-space:nowrap;'>" +
            '<button class="btn small" onclick="apercuForfait(\'' + esc(p.code) + '\')">Modifier</button> ' +
            '<button class="btn small danger" onclick="supprimerForfait(\'' + esc(p.code) + '\')">Suppr.</button>' +
            "</td>" +
            "</tr>"
        )
        .join("");
  } catch (e) {
    document.getElementById("tab-packages").innerHTML = '<tr><td>' + esc(e.message) + "</td></tr>";
  }
}

async function apercuForfait(code) {
  if (!packagesAdmin.length) await chargerForfaitsListe();
  const p = packagesAdmin.find((x) => x.code === code);
  if (!p) return;
  const nouveauNom = prompt("Nom du forfait :", p.nom);
  if (nouveauNom === null) return;
  const nouveauPrix = prompt("Prix (" + p.devise + ") :", p.prix || 0);
  if (nouveauPrix === null) return;
  const nouveauGo = prompt("Quantité en Go :", p.quantiteGo || 0);
  if (nouveauGo === null) return;
  try {
    await api("/api/admin/packages/" + encodeURIComponent(code), {
      method: "PUT",
      body: { nom: nouveauNom, prix: Number(nouveauPrix) || 0, quantiteGo: Number(nouveauGo) || 0 }
    });
    toast("Forfait mis à jour", "success");
    chargerForfaitsAdmin();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function supprimerForfait(code) {
  if (!confirm("Supprimer ce forfait ?")) return;
  try {
    await api("/api/admin/packages/" + encodeURIComponent(code), { method: "DELETE" });
    toast("Forfait supprimé", "success");
    chargerForfaitsAdmin();
  } catch (e) {
    toast(e.message, "error");
  }
}
// ---------- Clients ----------
async function chargerClients() {
  try {
    const d = await adminGet("/customers");
    const tab = document.getElementById("tab-customers");
    tab.innerHTML =
      "<tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Pays</th><th>Commandes</th><th>Total payé</th><th>Dernier achat</th></tr>" +
      (d.clients || [])
        .map(
          (c) =>
            "<tr>" +
            "<td>" + esc(c.nom || "—") + "</td>" +
            "<td>" + esc(c.telephone || "—") + "</td>" +
            "<td>" + esc(c.email || "—") + "</td>" +
            "<td>" + esc(c.pays || "—") + "</td>" +
            "<td>" + c.commandes + "</td>" +
            "<td>" + formatMontant(c.totalPaye, "CDF") + "</td>" +
            "<td class='muted'>" + new Date(c.dernier).toLocaleDateString("fr-FR") + "</td>" +
            "</tr>"
        )
        .join("");
  } catch (e) {
    document.getElementById("tab-customers").innerHTML = '<tr><td>' + esc(e.message) + "</td></tr>";
  }
}

// ---------- Messages ----------
async function chargerMessages() {
  try {
    const d = await adminGet("/messages");
    const box = document.getElementById("list-messages");
    const list = d.messages || [];
    if (!list.length) {
      box.innerHTML = "<p class='muted'>Aucun message pour le moment.</p>";
      return;
    }
    box.innerHTML = list
      .map(
        (m) =>
          '<div style="background:#171f2e;border:1px solid #263149;border-radius:11px;padding:14px;margin-bottom:10px;">' +
          "<div style='display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;'>" +
          "<b>" + esc(m.nom) + " <span class='muted'>(" + esc(m.telephone || "pas de téléphone") + ")</span></b>" +
          '<span class="muted" style="font-size:12px;">' + new Date(m.creeLe).toLocaleString("fr-FR") + "</span>" +
          "</div>" +
          (m.email ? '<div class="muted" style="font-size:13px;">' + esc(m.email) + "</div>" : "") +
          '<div style="background:#0e141d;border-radius:8px;padding:10px;margin-top:8px;">' +
          "<b>" + esc(m.sujet || "Message") + "</b><br>" + esc(m.message) +
          "</div>" +
          '<button class="btn small danger" style="margin-top:8px;" onclick="supprimerMessage(\'' + m.id + '\')">Supprimer</button>' +
          "</div>"
      )
      .join("");
  } catch (e) {
    document.getElementById("list-messages").innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

async function supprimerMessage(id) {
  if (!confirm("Supprimer ce message ?")) return;
  try {
    await api("/api/admin/messages/" + id, { method: "DELETE" });
    toast("Message supprimé", "success");
    chargerMessages();
  } catch (e) {
    toast(e.message, "error");
  }
}

// ---------- Paramètres ----------
async function chargerParametres() {
  try {
    const c = await adminGet("/config");
    const s = c.site || {};
    document.getElementById("s-nom").value = s.nom || "";
    document.getElementById("s-slogan").value = s.slogan || "";
    document.getElementById("s-email").value = s.email || "";
    document.getElementById("s-tel").value = s.telephone || "";
    document.getElementById("s-wa").value = s.whatsapp || "";
    document.getElementById("s-adresse").value = s.adresse || "";
    document.getElementById("r-statut").value = (c.reseau && c.reseau.statut) || "operational";
    document.getElementById("r-message").value = (c.reseau && c.reseau.message) || "";

    const pmBox = document.getElementById("pm-list");
    pmBox.innerHTML = (c.paymentMethods || [])
      .map(
        (m) =>
          '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;">' +
          '<input type="checkbox" data-pm="' + esc(m.code) + '"' + (m.active ? " checked" : "") + "> " +
          '<span style="width:14px;height:14px;border-radius:4px;background:' + esc(m.couleur || "#334155") + ';"></span> ' +
          esc(m.nom) +
          "</label>"
      )
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

function lirePM() {
  const codes = [];
  document.querySelectorAll("[data-pm]").forEach((cb) => {
    codes.push({ code: cb.getAttribute("data-pm"), active: cb.checked });
  });
  return codes;
}
}
// ---------- Telegram ----------
async function chargerTelegramStatus() {
  try {
    const st = await adminGet("/telegram/status");
    const el = document.getElementById("tg-status");
    if (el) {
      el.innerHTML =
        "Bot : " + (st.botConfigured ? '<span class="badge ok">connecté</span>' : '<span class="badge bad">non configuré</span>') +
        " — Chat : " + (st.chatConfigured ? '<span class="badge ok">prêt</span>' : '<span class="badge warn">à détecter</span>');
    }
  } catch (_) { }
}

async function detecterTelegram() {
  const box = document.getElementById("tg-result");
  if (box) box.innerHTML = "<p class='muted'>Interrogation du bot…</p>";
  try {
    const r = await api("/api/admin/telegram/probe", { method: "POST", body: {} });
    if (!r.chats || !r.chats.length) {
      if (box) box.innerHTML = "<p class='muted'>Aucun chat trouvé. Ouvrez d'abord <b>@starnettellbot</b> et envoyez « /start ».</p>";
      return;
    }
    if (box) {
      const onglet = r.chats
        .map(
          (c) =>
            "<div>" +
            (c.id === Number(localStorage.getItem("tg_selected") || 0) ? "✅ " : "") +
            "<b>" + esc(c.nom) + "</b> — <span class='mono'>" + c.id + "</span>" +
            ' <button class="btn small" data-set-chat="' + c.id + '">Utiliser</button>' +
            "</div>"
        )
        .join("");
      box.innerHTML = "<div style='line-height:2;'>" + onglet + "</div>";
      box.querySelectorAll("[data-set-chat]").forEach((b) => {
        b.addEventListener("click", () => {
          localStorage.setItem("tg_selected", b.getAttribute("data-set-chat"));
          if (box) box.innerHTML =
            "<p class='muted'>Chat <span class='mono'>" + b.getAttribute("data-set-chat") + "</span> mémorisé ! " +
            "Collez cette valeur dans la variable d'environnement  <b>TELEGRAM_CHAT_ID</b> du projet Vercel (Paramètres → Environnement), " +
            "puis re-déployez.</p>";
        });
      });
    }
  } catch (e) {
    if (box) box.innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

async function testerTelegram() {
  const btn = document.getElementById("btn-tg-test");
  const box = document.getElementById("tg-result");
  if (btn) { btn.disabled = true; btn.textContent = "Envoi…"; }
  if (box) box.innerHTML = "<p class='muted'>Envoi…</p>";
  try {
    const r = await api("/api/admin/telegram/test", { method: "POST", body: {} });
    if (r.ok) {
      if (box) box.innerHTML = '<div class="alert success">✅ Message envoyé. Vérifiez votre Telegram !</div>';
    } else {
      if (box) box.innerHTML = '<div class="alert error">Envoi impossible : ' +
        (r.skipped === "no_chat" ? "chat non configuré" : (r.error || "erreur")) + "</div>";
    }
  } catch (e) {
    if (box) box.innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Envoyer un test"; }
  }
}

// ---------- Initialisation + événements ----------
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  chargerDashboard();

  document.getElementById("admin-user").textContent = "admin";

  document.getElementById("btn-logout").addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST", body: {} });
    } catch (_) { }
    window.location.href = "/admin/login.html";
  });

  document.getElementById("btn-refresh-orders").addEventListener("click", chargerCommandes);
  document.getElementById("q-orders").addEventListener("input", renderCommandes);
  document.getElementById("f-statut").addEventListener("change", renderCommandes);

  document.getElementById("btn-refresh-messages").addEventListener("click", chargerMessages);

  document.getElementById("form-site").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/config", {
        method: "PUT",
        body: {
          site: {
            nom: document.getElementById("s-nom").value,
            slogan: document.getElementById("s-slogan").value,
            email: document.getElementById("s-email").value,
            telephone: document.getElementById("s-tel").value,
            whatsapp: document.getElementById("s-wa").value,
            adresse: document.getElementById("s-adresse").value
          }
        }
      });
      clignote(e.target.querySelector("button"));
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.getElementById("form-reseau").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/config", {
        method: "PUT",
        body: {
          reseau: {
            statut: document.getElementById("r-statut").value,
            message: document.getElementById("r-message").value
          }
        }
      });
      clignote(e.target.querySelector("button"));
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.getElementById("pm-list").addEventListener("change", async () => {
    try {
      await api("/api/admin/config", { method: "PUT", body: { paymentMethods: lirePM() } });
      toast("Moyens de paiement mis à jour", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.getElementById("form-password").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("pd-current").value;
    const next = document.getElementById("pd-next").value;
    try {
      await api("/api/admin/settings/password", { method: "POST", body: { current, next } });
      toast("Mot de passe modifié", "success");
      e.target.reset();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  // Telegram
  const btnProbe = document.getElementById("btn-tg-probe");
  if (btnProbe) btnProbe.addEventListener("click", detecterTelegram);
  const btnTest = document.getElementById("btn-tg-test");
  if (btnTest) btnTest.addEventListener("click", testerTelegram);
  if (document.getElementById("tg-status")) chargerTelegramStatus();
});