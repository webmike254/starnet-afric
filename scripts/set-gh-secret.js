"use strict";
/**
 * Chiffre une valeur avec la clé publique GitHub (sealed box) et imprime
 * le payload JSON attendu par PUT /actions/secrets/{name}.
 * Usage : node scripts/set-gh-secret.js VALEUR_CHIFFRER
 */

const sodium = require("libsodium-wrappers");

const owner = "webmike254";
const repo = "starnet-afric";
const ghToken = process.env.GITHUB_TOKEN || "";
const value = process.argv[1];

if (!ghToken || !value) {
  console.error("GITHUB_TOKEN et VALEUR requis.");
  process.exit(1);
}

(async () => {
  const keyRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`, {
    headers: { Authorization: "Bearer " + ghToken, "User-Agent": "starnet-ci" }
  });
  if (!keyRes.ok) throw new Error("GET public-key " + keyRes.status);
  const key = await keyRes.json();

  await sodium.ready;
  const V = sodium.base64_variants.ORIGINAL;
  const pub = sodium.from_base64(key.key, V);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), pub);
  const enc = sodium.to_base64(sealed, V);

  const fs = require("fs");
  const path = require("path");
  const payload = JSON.stringify({ encrypted_value: enc, key_id: key.key_id });
  fs.writeFileSync(path.join(__dirname, "..", "secret-payload.json"), payload, "utf8");
  console.log("PAYLOAD_OK");
})().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});