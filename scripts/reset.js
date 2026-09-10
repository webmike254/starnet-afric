"use strict";
// Réinitialise les données (base vide + forfaits par défaut).
const fs = require("fs");
const path = require("path");
const dbFile = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
fs.rmSync(dbFile, { force: true });
console.log("Base réinitialisée :", dbFile);
console.log("Relancez le serveur : npm start");