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
const { registerAuthRoutes } = require("./auth-routes");

function escHTML(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

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

async function buildApp() {
  if (appReady) return appReady;
  appReady = (async () => {
    loadEnv();
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const salt = crypto.randomBytes(16).toString("hex");
    const hashedAdmin = security.hashPassword(adminPassword, salt);
    await db.init(() => seed.makeSeed({ adminUser, adminPassword, hashedAdmin, salt, siteInfo: {} }));
    if (process.env.ADMIN_PASSWORD) {
      const freshSalt = crypto.randomBytes(16).toString("hex");
      db.data.admin.user = process.env.ADMIN_USER || db.data.admin.user;
      db.data.admin.passwordHash = security.hashPassword(process.env.ADMIN_PASSWORD, freshSalt);
      db.data.admin.salt = freshSalt;
      db.flushSoon();
    }
    if (!db.data.admin.user) db.data.admin.user = "admin";
    return createApp();
  })().catch((err) => { appReady = null; throw err; });
  return appReady;
}

function createApp() {
  const express = require("express");
  const app = express();
  const isProd = (process.env.NODE_ENV || "development") === "production";
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200kb" }));

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

  app.use(analytics.analyticsMiddleware(db));
  app.use("/api", (req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); next(); });

  const rateBuckets = {};
  function rateLimit(key, max, windowMs) {
    return (req, res, next) => {
      const ip = req.ip || "?";
      const now = Date.now();
      const k = key + ":" + ip;
      const b = (rateBuckets[k] = rateBuckets[k] || { ats: [] });
      b.ats = b.ats.filter((t) => now - t < windowMs);
      if (b.ats.length >= max) return res.status(429).json({ error: "Trop de requetes." });
      b.ats.push(now);
      next();
    };
  }

  app.get("/api/health", (req, res) => res.json({ ok: true, temps: new Date().toISOString(), backend: db.backend }));
  app.get("/api/packages", (req, res) => res.json({ packages: db.data.packages.filter((p) => p.actif) }));
  app.get("/api/pays", (req, res) => res.json({ pays: db.data.countries }));
  app.get("/api/payment-methods", (req, res) => res.json({ methodes: db.data.paymentMethods.filter((m) => m.active) }));
  app.get("/api/config-public", (req, res) => {
    const c = db.data.config;
    res.json({ site: c.site, reseau: c.reseau, modePaiement: payments.MODE });
  });

  app.get("/api/visit", (req, res) => {
    try {
      const p = String(req.query.p || "/").slice(0, 200);
      const ua = String(req.headers["user-agent"] || "");
      let vid = String(req.cookies.slv || "");
      if (!vid) {
        vid = analytics.recordVisit(db, { vid: null, path: p, referrer: req.headers.referer, ua });
        res.cookie(analytics.COOKIE_NAME, vid, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "Lax", path: "/" });
      } else {
        analytics.recordVisit(db, { vid, path: p, referrer: req.headers.referer, ua });
      }
      res.json({ ok: true });
    } catch (_) { res.json({ ok: true }); }
  });

  app.post("/api/contact", rateLimit("contact", 5, 60000), async (req, res) => {
    const { nom, telephone, email, sujet, message } = req.body || {};
    if (!nom || !message) return res.status(400).json({ error: "Nom et message obligatoires." });
    const id = db.nextId("contact");
    db.data.messages.push({ id, nom: String(nom).trim().slice(0, 120), telephone: String(telephone || "").trim().slice(0, 40), email: String(email || "").trim().slice(0, 120), sujet: String(sujet || "").trim().slice(0, 120), message: String(message).trim().slice(0, 2000), creeLe: new Date().toISOString() });
    try { await db.flushNow(); } catch (e) {}
    telegram.notify("New contact from " + String(nom).slice(0, 120));
    res.json({ ok: true, id });
  });

  registerAuthRoutes(app, db, rateLimit);

  app.post("/api/orders", rateLimit("orders", 10, 10 * 60 * 1000), async (req, res) => {
    let { nom, telephone, email, pays, packageCode, methodePaiement } = req.body || {};
    nom = String(nom || "").trim() || ("Client " + String(telephone || "").replace(/\D/g, "").slice(-9)).trim();
    if (!telephone || !packageCode || !methodePaiement) return res.status(400).json({ error: "Champs obligatoires manquants." });
    const pkg = db.data.packages.find((p) => p.code === packageCode && p.actif);
    if (!pkg) return res.status(400).json({ error: "Forfait inconnu." });
    if (!payments.isEnabled(methodePaiement)) return res.status(400).json({ error: "Paiement indisponible." });
    const reference = db.nextRef();
    const order = { reference, creeLe: new Date().toISOString(), nom: String(nom).trim().slice(0, 120), telephone: String(telephone).trim().slice(0, 40), email: String(email || "").trim().slice(0, 120), pays: String(pays || "CD").slice(0, 6), package: { code: pkg.code, nom: pkg.nom, quantiteGo: pkg.quantiteGo }, montant: pkg.prix > 0 ? pkg.prix : null, devise: pkg.devise, methodePaiement, statut: "en_attente_paiement", paiement: null, notes: "" };
    if (pkg.type === "kit" || pkg.prix <= 0) { order.statut = "en_traitement"; order.devis = true; }
    else order.montant = pkg.prix;
    db.data.orders.push(order);
    db.flushSoon();
    if (!order.devis) {
      try {
        await payments.initierPaiement(db, { order, provider: methodePaiement, montant: order.montant, devise: order.devise, telephone: order.telephone });
      } catch (e) {
        order.statut = "echec_paiement";
        order.notes = String(e.message || "init").slice(0, 300);
        try { await db.flushNow(); } catch (_) {}
        return res.status(502).json({ error: "Impossible d'initialiser le paiement." });
      }
    }
    try { await db.flushNow(); } catch (e) {}
    telegram.notify("New order " + String(reference));
    res.json({ ok: true, reference, mode: payments.MODE, order });
  });

  app.get("/api/track/:ref", (req, res) => {
    const ref = String(req.params.ref || "").toUpperCase();
    const order = db.data.orders.find((o) => o.reference.toUpperCase() === ref);
    if (!order) return res.status(404).json({ error: "Commande introuvable." });
    res.json({ reference: order.reference, statut: order.statut, creeLe: order.creeLe, package: order.package && order.package.nom, montant: order.montant, devise: order.devise, paiement: order.paiement ? { statut: order.paiement.statut, provider: order.paiement.provider } : null });
  });

  app.post("/api/payments/initiate", rateLimit("payinit", 10, 10 * 60 * 1000), async (req, res) => {
    const { reference } = req.body || {};
    const order = db.data.orders.find((o) => o.reference === String(reference || ""));
    if (!order) return res.status(404).json({ error: "Commande introuvable." });
    res.json({ ok: true, reference: order.reference, statut: order.paiement ? order.paiement.statut : order.statut });
  });

  app.post("/api/payments/webhook/:provider", async (req, res) => {
    const provider = String(req.params.provider || "");
    const result = payments.traiterWebhook(db, provider, req.body || {}, req.headers["x-signature"] || "");
    try { await db.flushNow(); } catch (_) {}
    res.json(result);
  });

  app.post("/api/admin/login", rateLimit("login", 8, 5 * 60 * 1000), async (req, res) => {
    const { username, password } = req.body || {};
    const okUser = username && String(username).trim().toLowerCase() === String(db.data.admin.user || "").toLowerCase();
    const okPass = password && security.verifyPassword(String(password), db.data.admin.salt, db.data.admin.passwordHash);
    if (!okUser || !okPass) return res.status(401).json({ error: "Identifiants incorrects." });
    const token = security.createSession(db, req.headers["user-agent"] || "");
    res.cookie("sl_session", token, { maxAge: security.SESSION_TTL_MS / 1000, httpOnly: true, sameSite: "Lax", path: "/", secure: isProd });
    try { await db.flushNow(); } catch (_) {}
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", async (req, res) => {
    security.destroySession(db, req.cookies.sl_session);
    res.clearCookie("sl_session", { path: "/" });
    try { await db.flushNow(); } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/admin/me", security.requireAdmin(db), (req, res) => res.json({ user: db.data.admin.user }));

  const admin = express.Router();
  admin.use(security.requireAdmin(db));
  app.use("/api/admin", admin);

  admin.get("/summary", (req, res) => {
    const orders = db.data.orders;
    res.json({ totalCommandes: orders.length, backend: db.backend });
  });
  admin.get("/orders", (req, res) => res.json({ orders: db.data.orders.slice().reverse(), total: db.data.orders.length }));
  admin.get("/messages", (req, res) => res.json({ messages: db.data.messages.slice().reverse() }));
  admin.get("/packages", (req, res) => res.json({ packages: db.data.packages }));
  admin.get("/config", (req, res) => res.json({ config: db.data.config }));
  admin.get("/telegram/detect", async (req, res) => res.json(await telegram.detectChats()));
  admin.post("/telegram/test", async (req, res) => res.json(await telegram.notify("Test Starnet Afric")));

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir, { index: false, maxAge: isProd ? "1h" : 0 }));
  app.get("/", (req, res) => res.redirect(301, "/forfaits.html"));
  app.use((req, res) => {
    const notFound = path.join(publicDir, "404.html");
    if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
    res.status(404).json({ error: "Not found" });
  });
  app.use((err, req, res, next) => {
    console.error("[erreur]", err.message);
    res.status(500).json({ error: "Erreur interne.", detail: err.message });
  });
  return app;
}

module.exports = { buildApp };
