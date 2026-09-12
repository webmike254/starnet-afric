"use strict";

const store = require("./store");

/**
 * Magasin de données : chargement initial depuis le backend de persistance,
 * écritures différées (flushSoon) ou immédiates (flushNow).
 */
class DB {
  constructor() {
    this.data = null;
    this._timer = null;
  }

  async init(seedFn) {
    if (this.data) return this.data;
    let raw = null;
    try {
      raw = await store.load();
    } catch (err) {
      console.warn("[db] Lecture du backend impossible (" + store.backendName + ") : " + err.message);
    }
    if (raw && raw.trim().length > 2) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.config && parsed.packages) {
          this.data = parsed;
          return this.data;
        }
      } catch (_) {
        /* fichier corrompu -> réinitialisation */
      }
    }
    this.data = seedFn();
    try {
      await this.save();
    } catch (err) {
      console.warn("[db] Écriture initiale échouée : " + err.message);
    }
    return this.data;
  }

  get backend() {
    return store.backendName;
  }

  async save() {
    if (!this.data) return;
    const raw = JSON.stringify(this.data);
    await store.save(raw);
  }

  /** Sauvegarde différée (regroupe plusieurs écritures en une seule). */
  flushSoon() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.save().catch((e) => console.error("[db] Écriture différée échouée : " + e.message));
    }, 300);
  }

  /** Sauvegarde immédiate (utilisée avant la fin d'une requête en serverless). */
  async flushNow() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (!this.data) return;
    await this.save();
  }

  nextId(prefix) {
    this.data.sequence = this.data.sequence || {};
    this.data.sequence[prefix] = (this.data.sequence[prefix] || 1000) + 1;
    return prefix.toUpperCase() + "-" + this.data.sequence[prefix];
  }

  /** Numéro de référence de commande « conversationnel » p.ex : SL-1042 */
  nextRef() {
    this.data.sequence.order = (this.data.sequence.order || 1000) + 1;
    return "SL-" + this.data.sequence.order;
  }
}

module.exports = new DB();