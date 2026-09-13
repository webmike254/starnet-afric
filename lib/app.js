"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const db = require("./db");
const security = require("./security");
const analytics = require("./analytics");
const payments = require("./payments");
const seed = require("./seed");
const telegram = require("./telegram");

// Échappement HTML pour les messages Telegram (parse_mode HTML).
function escHTML(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Chargement du fichier .env (racine du projet) s'il existe.
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

let appReady = null;

/**
 * Construit (et met en cache) l'application Express.
 * Attend l'initialisation de la base avant de retourner l'app.
 */
async function buildApp() {
  if (appReady) return appReady;
  appReady = (async () => {
    loadEnv();

    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const salt = crypto.randomBytes(16).toString("hex");
    const hashedAdmin = security.hashPassword(adminPassword, salt);

    await db.init(() =>
      seed.makeSeed({ adminUser, adminPassword, hashedAdmin, salt, siteInfo: {} })
    );

    if (process.env.ADMIN_PASSWORD) {
      const freshSalt = crypto.randomBytes(16).toString("hex");
      db.data.admin.user = process.env.ADMIN_USER || db.data.admin.user;
      db.data.admin.passwordHash = security.hashPassword(process.env.ADMIN_PASSWORD, freshSalt);
      db.data.admin.salt = freshSalt;
      db.flushSoon();
    }
    if (!db.data.admin.user) db.data.admin.user = "admin";
    if (process.env.ADMIN_PASSWORD === undefined && (adminPassword === "admin123" || !db.data.admin.passwordHash)) {
      console.warn("[!] Mot de passe administrateur PAR DÉFAUT (admin123) actif — changez-le dans le panneau admin dès que possible.");
    }

    return createApp();
  })().catch((err) => {
    appReady = null;
    throw err;
  });
  return appReady;
}

function createApp() {
  const express = require("express");
  const app = express();
  const isProd = (process.env.NODE_ENV || "development") === "production";

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200kb" }));

  // Cookies : petit utilitaire sans extension.
  const COOKIE_ATTRS = (opts) => {
    const parts = [opts.value ? opts.value : ""];
    if (opts.maxAge) parts.push("Max-Age=" + opts.maxAge);
    parts.push("Path=" + (opts.path || "/"));
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.sameSite) parts.push("SameSite=" + opts.sameSite);
    if (opts.secure) parts.push("Secure");
    return parts.join("; ");
  };
  app.use((req, res, next) => {
    const cookies = {};
    const raw = String(req.headers.cookie || "");
    for (const pair of raw.split(";")) {
      const i = pair.indexOf("=");
      if (i > 0) cookies[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
    }
    req.cookies = cookies;
    res.cookie = (name, value, opts) => {
      res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; ${COOKIE_ATTRS({ ...opts, value })}`);
    };
    next();
  });

  // Analytique (visites, pages, appareils) — éthique.
  app.use(analytics.analyticsMiddleware(db));

  app.use("/api", (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  // ---------- Rate limiting ----------
  const rateBuckets = {};
  function rateLimit(key, max, windowMs) {
    return (req, res, next) => {
      const ip = req.ip || "?";
      const now = Date.now();
      const k = key + ":" + ip;
      const b = (rateBuckets[k] = rateBuckets[k] || { ats: [] });
      b.ats = b.ats.filter((t) => now - t < windowMs);
      if (b.ats.length >= max) return res.status(429).json({ error: "Trop de requêtes, réessayez dans quelques minutes." });
      b.ats.push(now);
      next();
    };
  }

  // ---------- Routes publiques ----------
  app.get("/api/health", (req, res) => res.json({ ok: true, temps: new Date().toISOString(), backend: db.backend }));

  // Beacon analytique (pages servies statiquement par le CDN).
  app.get("/api/visit", (req, res) => {
    try {
      const path = String(req.query.p || req.path || "/").slice(0, 200);
      if (path === "/api/visit") return res.json({ ok: true });
      const ua = String(req.headers["user-agent"] || "");
      let vid = String(req.cookies.slv || "");
      if (!vid) {
        vid = analytics.recordVisit(db, { vid: null, path, referrer: req.headers.referer, ua });
        res.cookie(analytics.COOKIE_NAME, vid, {
          maxAge: 60 * 60 * 24 * 365,
          httpOnly: true,
          sameSite: "Lax",
          path: "/"
        });
      } else {
        analytics.recordVisit(db, { vid, path, referrer: req.headers.referer, ua });
      }
      res.json({ ok: true });
    } catch (_) {
      res.json({ ok: true });
    }
  });

  app.get("/api/packages", (req, res) => {
    res.json({ packages: db.data.packages.filter((p) => p.actif) });
  });

  app.get("/api/pays", (req, res) => res.json({ pays: db.data.countries }));

  app.get("/api/payment-methods", (req, res) => {
    res.json({ methodes: db.data.paymentMethods.filter((m) => m.active) });
  });

  app.get("/api/config-public", (req, res) => {
    const c = db.data.config;
    res.json({
      site: c.site,
      reseau: c.reseau,
      modePaiement: payments.MODE
    });
  });

  app.post(
    "/api/contact",
    rateLimit("contact", 5, 60000),
    async (req, res) => {
      const { nom, telephone, email, sujet, message } = req.body || {};
      if (!nom || !message || String(nom).trim().length < 2 || String(message).trim().length < 5) {
        return res.status(400).json({ error: "Nom et message sont obligatoires." });
      }
      const id = db.nextId("contact");
      db.data.messages.push({
        id,
        nom: String(nom).trim().slice(0, 120),
        telephone: String(telephone || "").trim().slice(0, 40),
        email: String(email || "").trim().slice(0, 120),
        sujet: String(sujet || "").trim().slice(0, 120),
        message: String(message).trim().slice(0, 2000),
        creeLe: new Date().toISOString()
      });
      try {
        await db.flushNow();
      } catch (e) {
        console.error("[db] contact save", e.message);
      }
      telegram.notify(
        "📩 <b>Nouveau message de contact</b>\n" +
        "👤 " + escHTML(String(nom).slice(0, 120)) + "\n" +
        (String(telephone || "").trim() ? "📞 " + escHTML(String(telephone).slice(0, 40)) + "\n" : "") +
        (String(email || "").trim() ? "✉️ " + escHTML(String(email).slice(0, 120)) + "\n" : "") +
        "📌 Sujet : " + escHTML(sujet || "—") + "\n" +
        "💬 " + escHTML(String(message).slice(0, 400))
      );
      res.json({ ok: true, id });
    }
  );
// ---------- Commandes ----------
  app.post(
    "/api/orders",
    rateLimit("orders", 10, 10 * 60 * 1000),
    async (req, res) => {
      let { nom, telephone, email, pays, packageCode, methodePaiement } = req.body || {};
      nom = String(nom || "").trim() || ("Client " + String(telephone || "").replace(/\D/g, "").slice(-9)).trim();
      if (!telephone || !packageCode || !methodePaiement) {
        return res.status(400).json({ error: "Champs obligatoires manquants (téléphone, forfait, paiement)." });
      }
      const pkg = db.data.packages.find((p) => p.code === packageCode && p.actif);
      if (!pkg) return res.status(400).json({ error: "Forfait inconnu." });
      if (!payments.isEnabled(methodePaiement)) {
        return res.status(400).json({ error: "Moyen de paiement indisponible momentanément." });
      }

      const reference = db.nextRef();
      const order = {
        reference,
        creeLe: new Date().toISOString(),
        nom: String(nom).trim().slice(0, 120),
        telephone: String(telephone).trim().slice(0, 40),
        email: String(email || "").trim().slice(0, 120),
        pays: String(pays || "CD").slice(0, 6),
        package: { code: pkg.code, nom: pkg.nom, quantiteGo: pkg.quantiteGo },
        montant: pkg.prix > 0 ? pkg.prix : null,
        devise: pkg.devise,
        methodePaiement,
        statut: "en_attente_paiement",
        paiement: null,
        notes: ""
      };

      if (pkg.type === "kit" || pkg.prix <= 0) {
        order.statut = "en_traitement";
        order.devis = true;
      } else {
        order.montant = pkg.prix;
      }

      db.data.orders.push(order);
      db.flushSoon();

      if (!order.devis) {
        try {
          await payments.initierPaiement(db, {
            order,
            provider: methodePaiement,
            montant: order.montant,
            devise: order.devise,
            telephone: order.telephone
          });
        } catch (e) {
          order.statut = "echec_paiement";
          order.notes = String(e.message || "init").slice(0, 300);
          try {
            await db.flushNow();
          } catch (_) { }
          return res.status(502).json({ error: "Impossible d'initialiser le paiement : " + (e.message || "") + " Réessayez ou contactez le support." });
        }
      }

      try {
        await db.flushNow();
      } catch (e) {
        console.error("[db] order save", e.message);
      }
      const nomPaiement = (db.data.paymentMethods.find((m) => m.code === methodePaiement) || {}).nom || methodePaiement;
      telegram.notify(
        "🛒 <b>Nouvelle commande</b> " + escHTML(String(reference)) + "\n" +
        "👤 " + escHTML(String(order.nom)) + "\n" +
        "📞 " + escHTML(String(order.telephone)) + "\n" +
        "📦 " + escHTML(order.package.nom) + (order.package.quantiteGo ? " (" + order.package.quantiteGo + " Go)" : "") + "\n" +
        (order.montant ? "💰 " + escHTML(String(order.montant)) + " " + escHTML(String(order.devise)) + "\n" : "💰 Sur devis\n") +
        "💳 " + escHTML(nomPaiement)
      );
      res.json({ ok: true, reference, mode: payments.MODE, order });
    }
  );

  app.get("/api/track/:ref", (req, res) => {
    const ref = String(req.params.ref || "").toUpperCase();
    const order = db.data.orders.find((o) => o.reference.toUpperCase() === ref);
    if (!order) return res.status(404).json({ error: "Commande introuvable." });
    res.json({
      reference: order.reference,
      statut: order.statut,
      creeLe: order.creeLe,
      package: order.package && order.package.nom,
      montant: order.montant,
      devise: order.devise,
      paiement: order.paiement ? { statut: order.paiement.statut, provider: order.paiement.provider } : null
    });
  });

  app.post(
    "/api/payments/initiate",
    rateLimit("payinit", 10, 10 * 60 * 1000),
    async (req, res) => {
      const { reference } = req.body || {};
      const order = db.data.orders.find((o) => o.reference === String(reference || ""));
      if (!order) return res.status(404).json({ error: "Commande introuvable." });
      if (!order.paiement || order.paiement.statut === "confirme") {
        return res.json({ ok: true, reference: order.reference, statut: order.paiement ? order.paiement.statut : order.statut });
      }
      try {
        const r = await payments.initierPaiement(db, {
          order,
          provider: order.methodePaiement,
          montant: order.montant,
          devise: order.devise,
          telephone: order.telephone
        });
        try {
          await db.flushNow();
        } catch (_) { }
        res.json({ ok: true, reference: order.reference, paiement: r.paiement });
      } catch (e) {
        res.status(502).json({ error: e.message || "Échec d'initiation du paiement." });
      }
    }
  );

  // Webhooks appelés par les passerelles officielles.
  app.post("/api/payments/webhook/:provider", async (req, res) => {
    const provider = String(req.params.provider || "");
    const result = payments.traiterWebhook(db, provider, req.body || {}, req.headers["x-signature"] || "");
    try {
      await db.flushNow();
    } catch (_) { }
    res.json(result);
  });

  // ---------- Administration ----------
  app.post("/api/admin/login", rateLimit("login", 8, 5 * 60 * 1000), async (req, res) => {
    const { username, password } = req.body || {};
    const okUser = username && String(username).trim().toLowerCase() === String(db.data.admin.user || "").toLowerCase();
    const okPass = password && security.verifyPassword(String(password), db.data.admin.salt, db.data.admin.passwordHash);
    if (!okUser || !okPass) return res.status(401).json({ error: "Identifiants incorrects." });

    const token = security.createSession(db, req.headers["user-agent"] || "");
    res.cookie("sl_session", token, {
      maxAge: security.SESSION_TTL_MS / 1000,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: isProd
    });
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", async (req, res) => {
    security.destroySession(db, req.cookies.sl_session);
    res.clearCookie("sl_session", { path: "/" });
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

  app.get("/api/admin/me", security.requireAdmin(db), (req, res) => {
    res.json({ user: db.data.admin.user });
  });

  const admin = express.Router();
  admin.use(security.requireAdmin(db), security.requireAjax);
  app.use("/api/admin", admin);

  admin.get("/summary", (req, res) => {
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const orders = db.data.orders;
    const todayOrders = orders.filter((o) => (o.creeLe || "").slice(0, 10) === today);
    const paid = orders.filter((o) => o.paiement && o.paiement.statut === "confirme");
    const totals = {};
    for (const o of paid) {
      if (!o.montant) continue;
      totals[o.devise] = (totals[o.devise] || 0) + o.montant;
    }
    const a = analytics.summary(db);
    res.json({
      totalCommandes: orders.length,
      commandesAujourdhui: todayOrders.length,
      enAttentePaiement: orders.filter((o) => o.statut === "en_attente_paiement").length,
      payees: paid.length,
      livrees: orders.filter((o) => o.statut === "livree").length,
      annulees: orders.filter((o) => o.statut === "annulee").length,
      revenus: totals,
      messagesNonLus: db.data.messages.length,
      backend: db.backend,
      analytics: {
        visitesAujourdhui: a.visitesAujourdhui,
        visites7j: a.visites7j,
        visiteurs7j: a.visiteurs7j,
        totalVisites: a.totalVisites
      },
      dernieresCommandes: orders.slice(-8).reverse().map((o) => ({
        reference: o.reference,
        creeLe: o.creeLe,
        nom: o.nom,
        telephone: o.telephone,
        statut: o.statut,
        paiement: o.paiement && o.paiement.statut,
        montant: o.montant,
        devise: o.devise
      }))
    });
  });

  admin.get("/analytics", (req, res) => res.json(analytics.summary(db)));

  admin.get("/orders", (req, res) => {
    const statut = String(req.query.statut || "").trim();
    const q = String(req.query.q || "").toLowerCase().trim();
    let list = db.data.orders;
    if (statut) list = list.filter((o) => o.statut === statut);
    if (q) list = list.filter((o) => [o.reference, o.nom, o.telephone, o.email].join(" ").toLowerCase().includes(q));
    const mapped = list.slice().reverse().map((o) => ({ ...o, paiement: o.paiement }));
    res.json({ orders: mapped, total: mapped.length });
  });

  admin.patch("/orders/:id", async (req, res) => {
    const o = db.data.orders.find((x) => x.reference === String(req.params.id).toUpperCase());
    if (!o) return res.status(404).json({ error: "Commande introuvable." });
    o.statut = String(req.body.statut || o.statut).slice(0, 40);
    if (req.body.notes !== undefined) o.notes = String(req.body.notes).slice(0, 500);
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true, statut: o.statut });
  });

  admin.post("/orders/:id/confirm-payment", async (req, res) => {
    const o = db.data.orders.find((x) => x.reference === String(req.params.id).toUpperCase());
    if (!o) return res.status(404).json({ error: "Commande introuvable." });
    if (!o.paiement) return res.status(400).json({ error: "Aucun paiement associé." });
    payments.confirmerManuellement(db, o);
    try {
      await db.flushNow();
    } catch (_) { }
    telegram.notify(
      "✅ <b>Paiement confirmé</b> " + escHTML(String(o.reference)) + "\n" +
      "👤 " + escHTML(String(o.nom)) + "\n" +
      "💰 " + (o.montant ? escHTML(String(o.montant)) + " " + escHTML(String(o.devise)) : "Devis")
    );
    res.json({ ok: true, statut: o.statut });
  });

  admin.delete("/orders/:id", async (req, res) => {
    const before = db.data.orders.length;
    db.data.orders = db.data.orders.filter((x) => x.reference !== String(req.params.id).toUpperCase());
    if (db.data.orders.length === before) return res.status(404).json({ error: "Commande introuvable." });
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

// ---------- Clients & Messages ----------
  admin.get("/customers", (req, res) => {
    const map = {};
    for (const o of db.data.orders) {
      const key = (o.telephone || o.email || "inconnu").toLowerCase();
      const c = (map[key] = map[key] || {
        nom: o.nom, telephone: o.telephone, email: o.email, pays: o.pays,
        premier: o.creeLe, dernier: o.creeLe, commandes: 0, totalPaye: 0
      });
      c.commandes++;
      c.dernier = o.creeLe;
      if (o.paiement && o.paiement.statut === "confirme" && o.montant) c.totalPaye += o.montant;
    }
    const list = Object.values(map).sort((a, b) => b.dernier.localeCompare(a.dernier));
    res.json({ clients: list.slice(0, 500) });
  });

  admin.get("/messages", (req, res) => res.json({ messages: db.data.messages.slice().reverse() }));
  admin.delete("/messages/:id", async (req, res) => {
    const id = Number(req.params.id);
    db.data.messages = db.data.messages.filter((m) => m.id !== id);
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

  // ---------- Forfaits ----------
  admin.get("/packages", (req, res) => res.json({ packages: db.data.packages }));
  admin.post("/packages", async (req, res) => {
    const p = req.body || {};
    if (!p.nom) return res.status(400).json({ error: "Nom requis." });
    const slug = String(p.code || "pkg").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    db.data.packages.push({
      code: slug + "-" + (db.data.packages.length + 1),
      nom: p.nom,
      description: p.description || "",
      quantiteGo: Number(p.quantiteGo) || 0,
      prix: Number(p.prix) || 0,
      prixPromo: Number(p.prixPromo) || 0,
      devise: p.devise || "CDF",
      type: p.type || "mensuel",
      populaire: !!p.populaire,
      actif: p.actif !== false,
      tags: Array.isArray(p.tags) ? p.tags : [],
      note: p.note || ""
    });
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });
  admin.put("/packages/:code", async (req, res) => {
    const p = db.data.packages.find((x) => x.code === String(req.params.code));
    if (!p) return res.status(404).json({ error: "Forfait introuvable." });
    const b = req.body || {};
    ["nom", "description", "devise", "type", "note"].forEach((k) => {
      if (b[k] !== undefined) p[k] = b[k];
    });
    if (b.quantiteGo !== undefined) p.quantiteGo = Number(b.quantiteGo) || 0;
    if (b.prix !== undefined) p.prix = Number(b.prix) || 0;
    if (b.prixPromo !== undefined) p.prixPromo = Number(b.prixPromo) || 0;
    if (b.populaire !== undefined) p.populaire = !!b.populaire;
    if (b.actif !== undefined) p.actif = !!b.actif;
    if (Array.isArray(b.tags)) p.tags = b.tags;
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });
  admin.delete("/packages/:code", async (req, res) => {
    const before = db.data.packages.length;
    db.data.packages = db.data.packages.filter((x) => x.code !== String(req.params.code));
    if (db.data.packages.length === before) return res.status(404).json({ error: "Forfait introuvable." });
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });
// ---------- Configuration ----------
  admin.get("/config", (req, res) => {
    res.json({ ...db.data.config, paymentMethods: db.data.paymentMethods });
  });
  admin.put("/config", async (req, res) => {
    const b = req.body || {};
    if (b.site) {
      Object.assign(db.data.config.site, {
        nom: b.site.nom || db.data.config.site.nom,
        slogan: b.site.slogan || db.data.config.site.slogan,
        email: b.site.email || db.data.config.site.email,
        telephone: b.site.telephone || db.data.config.site.telephone,
        whatsapp: b.site.whatsapp || db.data.config.site.whatsapp,
        adresse: b.site.adresse || db.data.config.site.adresse
      });
    }
    if (b.reseau) {
      db.data.config.reseau.statut = b.reseau.statut || db.data.config.reseau.statut;
      db.data.config.reseau.message = b.reseau.message || db.data.config.reseau.message;
      db.data.config.reseau.misAJour = new Date().toISOString();
    }
    if (Array.isArray(b.paymentMethods)) {
      for (const updated of b.paymentMethods) {
        const pm = db.data.paymentMethods.find((x) => x.code === updated.code);
        if (pm) pm.active = !!updated.active;
      }
    }
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

  admin.post("/settings/password", async (req, res) => {
    const { current, next: nextPass } = req.body || {};
    if (!security.verifyPassword(String(current), db.data.admin.salt, db.data.admin.passwordHash)) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect." });
    }
    if (!nextPass || String(nextPass).length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères." });
    }
    db.data.admin.salt = crypto.randomBytes(16).toString("hex");
    db.data.admin.passwordHash = security.hashPassword(String(nextPass), db.data.admin.salt);
    try {
      await db.flushNow();
    } catch (_) { }
    res.json({ ok: true });
  });

  // ---------- Telegram (notifications propriétaire) ----------
  admin.get("/telegram/status", (req, res) => {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chat = String(process.env.TELEGRAM_CHAT_ID || "").trim();
    res.json({
      botConfigured: !!token,
      chatConfigured: !!chat,
      botUsername: token ? "starnettellbot" : null
    });
  });

  admin.post("/telegram/probe", async (req, res) => {
    const r = await telegram.detectChats();
    if (!r.ok) return res.status(400).json({ error: r.error || "Impossible d'interroger le bot." });
    res.json({ chats: r.chats || [] });
  });

  admin.post("/telegram/test", async (req, res) => {
    const r = await telegram.notify("✅ Test réussi ! Votre boutique STARNÉT AFRIC vous enverra ses notifications ici.");
    res.json(r);
  });

  // ---------- Fichiers statiques ----------
  const PUBLIC_DIR = path.join(__dirname, "..", "public");

  app.get("/admin", (req, res) => {
    if (!security.sessionValid(db, req.cookies.sl_session)) return res.redirect("/admin/login.html");
    res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
  });

  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

  const REDIRECTS = {
    "/plans": "/forfaits.html", "/plans.html": "/forfaits.html",
    "/orders": "/commandes.html", "/orders.html": "/commandes.html",
    "/settings": "/parametres.html", "/settings.html": "/parametres.html",
    "/status": "/statut.html",
    "/": "/index.html"
  };
  app.get(Object.keys(REDIRECTS), (req, res) => res.redirect(301, REDIRECTS[req.path]));

  app.use((req, res) => {
    res.status(404).json({ error: "Page introuvable", url: req.url, path: req.path, via: "express" });
  });
  app.use((err, req, res, next) => {
    console.error("[erreur]", err.message);
    res.status(500).json({ error: "Erreur interne du serveur.", detail: err.message });
  });

  return app;
}

module.exports = { buildApp };