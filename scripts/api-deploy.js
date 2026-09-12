"use strict";

/**
 * Déploiement direct via l'API Vercel (sans CLI).
 * Construction de la liste de fichiers puis POST /v13/deployments.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = "team_ahD9wtU0XHcTLanZKtryeY01";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_gBG1B1wXvIP7ZlWSy1lVZha8emT0";
const NAME = "starnet-afric";

if (!TOKEN) {
  console.error("VERCEL_TOKEN manquant");
  process.exit(1);
}

const IGNORED_DIRS = new Set(["node_modules", "data", "legacy", ".git", ".vercel", "scripts"]);
const IGNORED_FILES = new Set([".env", "deploy.log", "deploy2.log", "deploy.err", "deploy2.err"]);

function ignore(name) {
  return IGNORED_DIRS.has(name) || IGNORED_FILES.has(name) || /^deploy.*\.(log|err)$/.test(name) || /\.(log|err)$/.test(name);
}

function walk(dir, prefix) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "data" || entry.name === "legacy" || entry.name === ".vercel" || entry.name === "scripts") continue;
    if (ignore(entry.name)) continue;
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, rel));
    } else {
      files.push({ file: "/" + rel, full });
    }
  }
  return files;
}

const files = walk(ROOT, "");
console.log("Fichiers à déployer : " + files.length);

const tracked = files.map((f) => ({
  file: f.file,
  encoding: "base64",
  data: fs.readFileSync(f.full).toString("base64")
}));

const body = {
  name: NAME,
  project: PROJECT_ID,
  files: tracked,
  target: "production"
};

const payload = JSON.stringify(body);
console.log("Taille du payload : " + (payload.length / 1024).toFixed(1) + " Ko");

const url = "https://api.vercel.com/v13/deployments?teamId=" + TEAM + "&forceNew=1";

fetch(url, {
  method: "POST",
  headers: {
    Authorization: "Bearer " + TOKEN,
    "Content-Type": "application/json",
    "User-Agent": "starnet-api-deploy"
  },
  body: payload
})
  .then(async (r) => {
    const text = await r.text();
    console.log("HTTP " + r.status);
    let j;
    try {
      j = JSON.parse(text);
    } catch (_) {
      console.log(text.slice(0, 500));
      process.exit(1);
    }
    if (j.error) {
      console.log("ERR: " + (j.error.message || JSON.stringify(j.error)));
      process.exit(1);
    }
    console.log("DEPLOY_CREATED uid=" + j.id);
    console.log("URL=" + (j.url || ""));
    console.log("READY_STATE=" + (j.readyState || ""));
    console.log("INSPECT=https://vercel.com/electronics1/starnet-afric/" + j.id);
  })
  .catch((e) => {
    console.error("Erreur réseau : " + e.message);
    process.exit(1);
  });