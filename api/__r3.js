"use strict";

/**
 * Vercel serverless entry. Never throws on require so /api/packages stays up.
 */

let db = null;
let buildApp = null;
let loadError = null;

try {
  db = require("../lib/db");
  buildApp = require("../lib/app").buildApp;
} catch (e) {
  loadError = e;
  console.error("[api] module load failed:", e && e.stack ? e.stack : e);
}

let appPromise = null;

module.exports = async (req, res) => {
  try {
    if (loadError) {
      // Absolute last resort: static packages so the forfaits page works
      if (req.url && req.url.indexOf("/api/packages") !== -1) {
        const seed = require("../lib/seed");
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ packages: seed.packagesParDefaut(), fallback: true }));
        return;
      }
      if (req.url && req.url.indexOf("/api/health") !== -1) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: String(loadError.message || loadError) }));
        return;
      }
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Server boot error", detail: String(loadError.message || loadError) }));
      return;
    }

    if (!appPromise) appPromise = buildApp();
    const app = await appPromise;

    if (!db.data) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Base non initialisée." }));
      return;
    }

    await new Promise((resolve) => {
      const done = () => resolve();
      res.on("finish", done);
      res.on("close", done);
      try {
        app(req, res);
      } catch (e) {
        console.error("[api] express sync error:", e.message);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e.message }));
        }
        resolve();
      }
    });

    try {
      await db.flushNow();
    } catch (e) {
      console.error("[api] flush", e.message);
    }
  } catch (err) {
    console.error("[api] erreur :", err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      // packages hard-fallback
      if (req.url && req.url.indexOf("/api/packages") !== -1) {
        try {
          const seed = require("../lib/seed");
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ packages: seed.packagesParDefaut(), fallback: true }));
          return;
        } catch (_) {}
      }
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Erreur interne du serveur.",
          detail: err && err.message ? err.message : String(err)
        })
      );
    }
  }
};
