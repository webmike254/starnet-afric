"use strict";

/**
 * Point d'entrée Vercel (serverless) — route « api/__r3 ».
 * Avec la configuration legacy vercel.json (builds + routes),
 * Vercel transmet l'URL d'origine intacte : Express route directement.
 */

const db = require("../lib/db");
const { buildApp } = require("../lib/app");

let appPromise = null;

module.exports = async (req, res) => {
  try {
    if (!appPromise) appPromise = buildApp();
    const app = await appPromise;

    if (!db.data) {
      res.status(500).json({ error: "Base non initialisée." });
      return;
    }

    // On attend la fin de la réponse, puis on sauvegarde les données.
    await new Promise((resolve) => {
      const done = () => resolve();
      res.on("finish", done);
      res.on("close", done);
      try {
        app(req, res);
      } catch (e) {
        console.error("[api] express sync error:", e.message);
        resolve();
      }
    });

    await db.flushNow();
  } catch (err) {
    console.error("[api] erreur :", err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur interne du serveur.", detail: err && err.message ? err.message : String(err) });
    }
  }
};