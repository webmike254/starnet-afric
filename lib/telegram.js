"use strict";

/**
 * Intégration Telegram (bot @starnettellbot).
 *
 * Envoie des notifications métier légitimes au propriétaire :
 *    - nouvelle commande,
 *    - nouveau message de contact,
 *    - paiement confirmé.
 *
 * Le token et le chat_id sont lus UNIQUEMENT côté serveur (variables d'env),
 * jamais dans le code du navigateur.
 *
 * NOTE : ce module n'intercepte JAMAIS de code PIN/OTP — ces secrets ne sont
 * pas collectés par la plateforme (la vérification est faite par l'opérateur).
 */

const API = "https://api.telegram.org";

function config() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  return { token, chatId };
}

let warnedNoToken = false;
let warnedNoChat = false;

/** Envoie une notification au propriétaire. Retourne un objet de statut. */
async function notify(text) {
  const { token, chatId } = config();
  if (!token) {
    if (!warnedNoToken) {
      console.warn("[telegram] TELEGRAM_BOT_TOKEN non défini — notifications désactivées.");
      warnedNoToken = true;
    }
    return { ok: false, skipped: "no_token" };
  }
  if (!chatId) {
    if (!warnedNoChat) {
      console.warn("[telegram] TELEGRAM_CHAT_ID non défini — envoyez /start au bot puis détectez le chat dans l'admin.");
      warnedNoChat = true;
    }
    return { ok: false, skipped: "no_chat" };
  }

  const safeText = String(text || "").slice(0, 4000);
  try {
    const r = await fetch(API + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "starnet-afric" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok !== true) {
      console.error("[telegram] sendMessage échec", r.status, j.description || j);
      return { ok: false, error: j.description || ("HTTP " + r.status) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[telegram] erreur réseau", e.message);
    return { ok: false, error: e.message };
  }
}

/** Liste les conversations les plus récentes connues par le bot (getUpdates). */
async function detectChats() {
  const { token } = config();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN non défini" };
  const r = await fetch(API + "/bot" + token + "/getUpdates?limit=10&timeout=0", {
    headers: { "User-Agent": "starnet-afric" }
  });
  const j = await r.json().catch(() => ({}));
  if (j.ok !== true) return { ok: false, error: j.description || "getUpdates échoué" };
  const chats = [];
  for (const u of j.result || []) {
    const c = u.message && u.message.chat;
    if (c && c.id && c.type && c.type !== "channel") {
      const n = c.first_name || c.username || c.title || "?";
      if (!chats.some((x) => x.id === c.id)) chats.push({ id: c.id, nom: n, type: c.type });
    }
  }
  return { ok: true, chats };
}

module.exports = { notify, detectChats };