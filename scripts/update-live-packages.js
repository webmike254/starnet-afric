"use strict";

/**
 * Met à jour les forfaits dans la base live (Gist) → forfaits par défaut.
 * Usage : GITHUB_TOKEN=... GIST_ID=... node scripts/update-live-packages.js
 */

const seed = require("../lib/seed");

const token = process.env.GITHUB_TOKEN || "";
const gistId = process.env.GIST_ID || "";
const GH = "https://api.github.com";

if (!token || !gistId) {
  console.error("GITHUB_TOKEN et GIST_ID requis.");
  process.exit(1);
}

(async () => {
  const getRes = await fetch(GH + "/gists/" + gistId, {
    headers: { Authorization: "Bearer " + token, "User-Agent": "starnet-afric", Accept: "application/vnd.github+json" }
  });
  if (!getRes.ok) throw new Error("GET gist " + getRes.status + " " + (await getRes.text()).slice(0, 200));
  const gist = await getRes.json();
  const f = gist.files && gist.files["db.json"];
  if (!f) throw new Error("db.json introuvable dans le gist");
  const db = JSON.parse(f.content);

  db.packages = seed.packagesParDefaut();
  db.sequence.order = db.sequence.order || 1000;

  const patch = await fetch(GH + "/gists/" + gistId, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token, "User-Agent": "starnet-afric", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ files: { "db.json": { content: JSON.stringify(db) } } })
  });
  if (!patch.ok) throw new Error("PATCH gist " + patch.status + " " + (await patch.text()).slice(0, 200));

  console.log("Forfaits mis à jour dans la base live : " + db.packages.length);
})().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});