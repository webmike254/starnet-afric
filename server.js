"use strict";

/**
 * Serveur local (développement).
 * Pour Vercel, voir api/index.js (même application via lib/app.js).
 */

const path = require("path");
const fs = require("fs");
const { buildApp } = require("./lib/app");
const db = require("./lib/db");
const payments = require("./lib/payments");

// Chargement du fichier .env s'il existe.
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
})();

const PORT = Number(process.env.PORT || 3000);

(async () => {
  const app = await buildApp();
  const adminUser = process.env.ADMIN_USER || db.data.admin.user || "admin";
  app.listen(PORT, () => {
    console.log("");
    console.log("  ╔══════════════════════════════════════════════════════╗");
    console.log("  ║   STARNÉT AFRIC — Plateforme Starlink Reseller        ║");
    console.log("  ╚══════════════════════════════════════════════════════╝");
    console.log("");
    console.log("   Site public :      http://localhost:" + PORT);
    console.log("   Administration :   http://localhost:" + PORT + "/admin/");
    console.log("   Connexion admin :  " + adminUser + " / " + (process.env.ADMIN_PASSWORD ? "*** (définie)" : "admin123 (PAR DÉFAUT !)"));
    console.log("   Persistance :      " + db.backend);
    console.log("   Mode paiement :    " + payments.MODE);
    console.log("");
  });
})().catch((err) => {
  console.error("[!] Échec du démarrage :", err.stack || err);
  process.exit(1);
});