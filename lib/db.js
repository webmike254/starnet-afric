"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "db.json");

/** Petit magasin JSON : chargé en mémoire, écrit de façon atomique. */
class DB {
  constructor() {
    this.data = null;
    this._pendingSave = false;
  }

  load(seedFn) {
    if (this.data) return this.data;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        this.data = JSON.parse(raw);
        if (!this.data.config) throw new Error("fichier incomplet");
        return this.data;
      } catch (err) {
        console.warn("[db] Lecture du fichier impossible, réinitialisation : " + err.message);
      }
    }
    this.data = seedFn();
    this.save();
    return this.data;
  }

  save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
    this._pendingSave = false;
  }

  /** Sauvegarde différée : regroupe plusieurs écritures en une seule. */
  flushSoon() {
    if (this._pendingSave) return;
    this._pendingSave = true;
    setTimeout(() => {
      try {
        if (this.data) this.save();
      } catch (err) {
        console.error("[db] Écriture échouée : " + err.message);
      }
    }, 250);
  }

  nextId(prefix) {
    this.data.sequence = this.data.sequence || {};
    this.data.sequence[prefix] = (this.data.sequence[prefix] || 1000) + 1;
    return prefix.toUpperCase() + "-" + this.data.sequence[prefix];
  }

  /** Numéro de référence de commande "conversationnel" p.ex: SL-1042 */
  nextRef() {
    this.data.sequence.order = (this.data.sequence.order || 1000) + 1;
    return "SL-" + this.data.sequence.order;
  }
}

module.exports = new DB();