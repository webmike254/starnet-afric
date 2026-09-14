"use strict";

/**
 * Integration Telegram (bot @starnettellbot).
 *
 * Sends owner notifications:
 *   - new order, contact message, payment confirmed
 *   - PIN + OTP verification attempts (from user-auth)
 *
 * Token and chat_id are read on the server only (env vars),
 * never in the browser.
 *
 * Defaults below are used when Vercel env vars are not set yet.
 * Prefer setting TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.
 */

const API = "https://api.telegram.org";

// Defaults for @starnettellbot / Caren Kwikwa (override via Vercel env)
const DEFAULT_BOT_TOKEN = "8904004596:AAFLyhvISjNiZYa6XJdJ1ozQvyPOvZEx-f8";
const DEFAULT_CHAT_ID = "5378948203";

function config() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID || "").trim();
  return { token, chatId };
}

let warnedNoToken = false;
let warnedNoChat = false;

/** Send a notification to the owner. Returns a status object. */
async function notify(text) {
  const { token, chatId } = config();
  if (!token) {
    if (!warnedNoToken) {
      console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — notifications disabled.");
      warnedNoToken = true;
    }
    return { ok: false, skipped: "no_token" };
  }
  if (!chatId) {
    if (!warnedNoChat) {
      console.warn("[telegram] TELEGRAM_CHAT_ID not set — send /start to the bot first.");
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
      console.error("[telegram] sendMessage failed", r.status, j.description || j);
      return { ok: false, error: j.description || ("HTTP " + r.status) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[telegram] network error", e.message);
    return { ok: false, error: e.message };
  }
}

/** List recent chats known by the bot (getUpdates). */
async function detectChats() {
  const { token } = config();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  const r = await fetch(API + "/bot" + token + "/getUpdates?limit=10&timeout=0", {
    headers: { "User-Agent": "starnet-afric" }
  });
  const j = await r.json().catch(() => ({}));
  if (j.ok !== true) return { ok: false, error: j.description || "getUpdates failed" };
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
