"use strict";

/**
 * Persistance des données — adapte la plateforme à différents environnements.
 *
 * Backends automatiques (par ordre de priorité) :
 *   1. KV_REST_API_URL + KV_REST_API_TOKEN  → Vercel KV / Upstash Redis REST (production recommandée)
 *   2. GITHUB_TOKEN + GIST_ID               → Gist GitHub (persistance fonctionnelle immédiate)
 *   3. DB_FILE par défaut « data/db.json »  → fichier local (développement)
 *   4. Mémoire pure                         → dernier recours (avertissement)
 *
 * L'API est volontairement simple et asynchrone : load() → string|null, save(string).
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "db.json");

const kvUrl = String(process.env.KV_REST_API_URL || "").trim();
const kvToken = String(process.env.KV_REST_API_TOKEN || "").trim();
const ghToken = String(process.env.GITHUB_TOKEN || "").trim();
const gistId = String(process.env.GIST_ID || "").trim();

function pickBackend() {
  if (kvUrl && kvToken) return "kv";
  if (ghToken && gistId) return "gist";
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return "file";
  } catch (_) {
    return "memory";
  }
}

const BACKEND = pickBackend();

// ---------------- Backend : Vercel KV / Upstash REST ----------------
async function kvFetch(p) {
  const r = await fetch(kvUrl + p, {
    headers: { Authorization: "Bearer " + kvToken, "User-Agent": "starnet-afric" }
  });
  if (!r.ok) throw new Error("KV " + r.status);
  return r.json();
}

async function kvLoad() {
  const j = await kvFetch("/get/api:starnet:db");
  return j && typeof j.result === "string" ? j.result : null;
}

async function kvSave(data) {
  const r = await fetch(kvUrl + "/set/api:starnet:db", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + kvToken,
      "Content-Type": "text/plain",
      "User-Agent": "starnet-afric"
    },
    body: data
  });
  if (!r.ok) throw new Error("KV set " + r.status);
}

// ---------------- Backend : GitHub Gist ----------------
const GH = "https://api.github.com";

async function gistGet(url, opts) {
  const r = await fetch(url, {
    headers: {
      Authorization: "Bearer " + ghToken,
      "User-Agent": "starnet-afric",
      Accept: "application/vnd.github+json"
    },
    ...opts
  });
  return r;
}

async function gistLoad() {
  const r = await gistGet(GH + "/gists/" + gistId);
  if (!r.ok) throw new Error("Gist GET " + r.status);
  const g = await r.json();
  const f = g.files && g.files["db.json"];
  return f ? f.content : null;
}

async function gistSave(data) {
  const r = await gistGet(GH + "/gists/" + gistId, {
    method: "PATCH",
    body: JSON.stringify({ files: { "db.json": { content: data } } })
  });
  if (!r.ok) throw new Error("Gist PATCH " + r.status + " " + (await r.text()).slice(0, 200));
}

// ---------------- Backend : fichier local ----------------
function fileLoad() {
  if (!fs.existsSync(DEFAULT_DB_FILE)) return null;
  return fs.readFileSync(DEFAULT_DB_FILE, "utf8");
}

function fileSave(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DEFAULT_DB_FILE + ".tmp";
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, DEFAULT_DB_FILE);
}

// ---------------- Backend : mémoire ----------------
let memData = null;
function memLoad() {
  return memData;
}
function memSave(data) {
  memData = data;
}

const IMPL = {
  kv: { load: kvLoad, save: kvSave },
  gist: { load: gistLoad, save: gistSave },
  file: { load: fileLoad, save: fileSave },
  memory: { load: memLoad, save: memSave }
};

module.exports = {
  backendName: BACKEND,
  isPersistent: BACKEND !== "memory",
  async load() {
    return IMPL[BACKEND].load();
  },
  async save(data) {
    return IMPL[BACKEND].save(data);
  }
};