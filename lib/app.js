"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");

// Optional deps — fall back so missing install never 500s the whole API
let cookieParser;
try {
  cookieParser = require("cookie-parser");
} catch (_) {
  cookieParser = function fallbackCookieParser() {
    return (req, res, next) => {
      req.cookies = req.cookies || {};
      const raw = String(req.headers.cookie || "");
      raw.split(";").forEach((part) => {
        const i = part.indexOf("=");
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k) req.cookies[k] = decodeURIComponent(v);
      });
      if (!res.cookie) {
        res.cookie = (name, val, opts) => {
          const max = (opts && opts.maxAge) || 0;
          const parts = [name + "=" + encodeURIComponent(val), "Path=" + ((opts && opts.path) || "/")];
          if (max) parts.push("Max-Age=" + Math.floor(max / 1000));
          if (opts && opts.httpOnly) parts.push("HttpOnly");
          if (opts && opts.secure) parts.push("Secure");
          if (opts && opts.sameSite) parts.push("SameSite=" + opts.sameSite);
          const prev = res.getHeader("Set-Cookie");
          const next = Array.isArray(prev) ? prev.concat(parts.join("; ")) : prev ? [prev, parts.join("; ")] : parts.join("; ");
          res.setHeader("Set-Cookie", next);
        };
      }
      next();
    };
  };
}

let cors;
try {
  cors = require("cors");
} catch (_) {
  cors = function fallbackCors(opts) {
    return (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", (opts && opts.origin === true && req.headers.origin) || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      if (req.method === "OPTIONS") return res.status(204).end();
      next();
    };
  };
}

const db = require("./db");
const security = require("./security");
const seed = require("./seed");
const telegram = require("./telegram");
const payments = require("./payments");
const { registerAuthRoutes } = require("./auth-routes");

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

function rateLimit(bucket, max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "ip")
      .split(",")[0]
      .trim();
    const key = bucket + ":" + ip;
    const now = Date.now();
    let arr = hits.get(key) || [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: "Trop de requêtes. Réessayez plus tard." });
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

function ensureDbShape() {
  if (!db.data) return;
  if (!db.data.admin) db.data.admin = { user: "admin", passwordHash: "", salt: "" };
  if (!db.data.sessions) db.data.sessions = {};
  if (!db.data.packages || !Array.isArray(db.data.packages) || !db.data.packages.length) {
    db.data.packages = seed.packagesParDefaut();
  }
  if (!db.data.config) db.data.config = seed.makeSeed({ adminUser: "admin", hashedAdmin: "", salt: "", siteInfo: {} }).config;
  if (!db.data.orders) db.data.orders = [];
  if (!db.data.messages) db.data.messages = [];
  if (!db.data.visits) db.data.visits = [];
  if (!db.data.loginLogs) db.data.loginLogs = [];
  if (!db.data.paymentMethods) db.data.paymentMethods = seed.PAYMENT_METHODS || [];
  if (!db.data.sequence) db.data.sequence = { order: 1000, contact: 100, payment: 5000 };
}

async function buildApp() {
  try {
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const salt = crypto.randomBytes(16).toString("hex");
    const hashedAdmin = security.hashPassword(adminPassword, salt);
    await db.init(() => seed.makeSeed({ adminUser, adminPassword, hashedAdmin, salt, siteInfo: {} }));
    ensureDbShape();
    if (process.env.ADMIN_PASSWORD) {
      const freshSalt = crypto.randomBytes(16).toString("hex");
      db.data.admin.user = process.env.ADMIN_USER || db.data.admin.user || "admin";
      db.data.admin.passwordHash = security.hashPassword(process.env.ADMIN_PASSWORD, freshSalt);
      db.data.admin.salt = freshSalt;
    }
    if (!db.data.admin.user) db.data.admin.user = "admin";
    // If admin hash missing (corrupt store), re-seed login
    if (!db.data.admin.passwordHash || !db.data.admin.salt) {
      db.data.admin.salt = salt;
      db.data.admin.passwordHash = hashedAdmin;
      db.data.admin.user = adminUser;
    }
  } catch (e) {
    console.error("[buildApp] init", e);
    // Last resort in-memory seed so /api/packages never hard-fails
    if (!db.data) {
      const salt = crypto.randomBytes(16).toString("hex");
      db.data = seed.makeSeed({
        adminUser: "admin",
        hashedAdmin: security.hashPassword("admin123", salt),
        salt,
        siteInfo: {}
      });
    }
    ensureDbShape();
  }

  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) =>
    res.json({ ok: true, t: Date.now(), packages: (db.data && db.data.packages && db.data.packages.length) || 0 })
  );

  app.get("/api/config-public", (req, res) => {
    try {
      ensureDbShape();
      const c = db.data.config || {};
      const methods = db.data.paymentMethods || c.paymentMethods || [];
      res.json({
        site: c.site || {},
        reseau: c.reseau || {},
        paymentMethods: methods.filter((p) => p.active !== false && p.actif !== false)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  registerAuthRoutes(app, db, rateLimit);

  // Public packages — never throw
  app.get("/api/packages", (req, res) => {
    try {
      ensureDbShape();
      const pkgs = (db.data.packages || []).filter((p) => p.actif !== false && p.active !== false);
      res.json({ packages: pkgs, count: pkgs.length });
    } catch (e) {
      console.error("[api/packages]", e);
      // Fallback static list so the UI still works
      const fallback = seed.packagesParDefaut();
      res.json({ packages: fallback, count: fallback.length, fallback: true });
    }
  });

  app.post("/api/orders", rateLimit("orders", 30, 60 * 1000), async (req, res) => {
    try {
      ensureDbShape();
      if (typeof payments.createOrder === "function") {
        const order = await payments.createOrder(db, req.body || {});
        return res.json(order);
      }
      // Minimal order record if createOrder not defined
      const body = req.body || {};
      const order = {
        id: crypto.randomBytes(6).toString("hex"),
        reference: db.nextRef ? db.nextRef() : "SL-" + Date.now(),
        phone: body.phone || "",
        package: body.package || body.pkg || "",
        amount: body.amount || body.montant || 0,
        provider: body.provider || "",
        statut: "en_attente_paiement",
        createdAt: new Date().toISOString()
      };
      db.data.orders.push(order);
      if (db.flushSoon) db.flushSoon();
      res.json({ ok: true, order });
    } catch (e) {
      res.status(400).json({ error: e.message || "Erreur commande" });
    }
  });

  app.post("/api/contact", rateLimit("contact", 10, 60 * 1000), async (req, res) => {
    try {
      ensureDbShape();
      const msg = {
        id: crypto.randomBytes(8).toString("hex"),
        name: String(req.body.name || "").slice(0, 120),
        phone: String(req.body.phone || "").slice(0, 40),
        email: String(req.body.email || "").slice(0, 120),
        message: String(req.body.message || "").slice(0, 2000),
        at: new Date().toISOString()
      };
      db.data.messages.push(msg);
      if (db.flushSoon) db.flushSoon();
      telegram.notify(`📩 <b>Message contact</b>\n${msg.name}\n${msg.phone}\n${msg.message}`).catch(() => {});
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.post("/api/admin/login", rateLimit("login", 8, 5 * 60 * 1000), async (req, res) => {
    try {
      ensureDbShape();
      const { username, password } = req.body || {};
      const okUser =
        username && String(username).trim().toLowerCase() === String(db.data.admin.user || "").toLowerCase();
      const okPass =
        password && security.verifyPassword(String(password), db.data.admin.salt, db.data.admin.passwordHash);
      if (!okUser || !okPass) return res.status(401).json({ error: "Identifiants incorrects." });
      const token = security.createSession(db, db.data.admin.user);
      res.cookie("sl_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/"
      });
      res.json({ ok: true, user: db.data.admin.user });
    } catch (e) {
      console.error("[admin/login]", e);
      res.status(500).json({ error: e.message || "Erreur login" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    try {
      security.destroySession(db, req.cookies && req.cookies.sl_session);
    } catch (_) {}
    res.clearCookie("sl_session", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/admin/me", security.requireAdmin(db), (req, res) => res.json({ user: db.data.admin.user }));

  const admin = express.Router();
  admin.use(security.requireAdmin(db));
  app.use("/api/admin", admin);

  admin.get("/summary", (req, res) => {
    ensureDbShape();
    res.json({
      totalCommandes: (db.data.orders || []).length,
      totalLogs: (db.data.loginLogs || []).length,
      backend: db.backend
    });
  });
  admin.get("/orders", (req, res) => {
    ensureDbShape();
    res.json({ orders: (db.data.orders || []).slice().reverse(), total: (db.data.orders || []).length });
  });
  admin.get("/messages", (req, res) => {
    ensureDbShape();
    res.json({ messages: (db.data.messages || []).slice().reverse() });
  });
  admin.get("/packages", (req, res) => {
    ensureDbShape();
    res.json({ packages: db.data.packages || [] });
  });
  admin.get("/config", (req, res) => {
    ensureDbShape();
    res.json({ config: db.data.config || {} });
  });
  admin.get("/telegram/detect", async (req, res) => res.json(await telegram.detectChats()));
  admin.post("/telegram/test", async (req, res) => res.json(await telegram.notify("Test Starnet Afric")));

  admin.get("/login-logs", (req, res) => {
    ensureDbShape();
    const logs = (db.data.loginLogs || []).slice().reverse();
    const limit = Math.min(parseInt(req.query.limit, 10) || 300, 1000);
    res.json({ logs: logs.slice(0, limit), total: (db.data.loginLogs || []).length });
  });
  admin.delete("/login-logs", (req, res) => {
    ensureDbShape();
    db.data.loginLogs = [];
    if (db.flushSoon) db.flushSoon();
    res.json({ ok: true });
  });
  admin.get("/verifications-summary", (req, res) => {
    ensureDbShape();
    const logs = db.data.loginLogs || [];
    const byAction = {};
    logs.forEach((l) => {
      byAction[l.action] = (byAction[l.action] || 0) + 1;
    });
    res.json({ total: logs.length, byAction, last: logs.slice(-20).reverse() });
  });

  admin.post("/settings/password", async (req, res) => {
    ensureDbShape();
    const current = String((req.body && req.body.current) || "");
    const next = String((req.body && req.body.next) || "");
    if (next.length < 6) return res.status(400).json({ error: "Mot de passe trop court (min 6)." });
    if (!security.verifyPassword(current, db.data.admin.salt, db.data.admin.passwordHash)) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    db.data.admin.salt = salt;
    db.data.admin.passwordHash = security.hashPassword(next, salt);
    if (db.flushSoon) db.flushSoon();
    res.json({ ok: true });
  });

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir, { index: false, maxAge: isProd ? "1h" : 0 }));
  app.get("/", (req, res) => res.redirect(301, "/forfaits.html"));
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    const notFound = path.join(publicDir, "404.html");
    if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
    res.status(404).json({ error: "Not found" });
  });
  app.use((err, req, res, next) => {
    console.error("[erreur]", err && err.message);
    if (!res.headersSent) res.status(500).json({ error: "Erreur interne.", detail: err && err.message });
  });
  return app;
}

module.exports = { buildApp };
