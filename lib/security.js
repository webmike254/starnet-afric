"use strict";

const crypto = require("crypto");

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

/** Hachage de mot de passe avec scrypt et sel aléatoire. */
function hashPassword(password, salt) {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = hashPassword(password, salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function createSession(db, ua) {
  const token = randomToken();
  db.data.sessions[token] = { createdAt: Date.now(), ua: String(ua || "").slice(0, 120) };
  db.flushSoon();
  return token;
}

function destroySession(db, token) {
  if (token && db.data.sessions) delete db.data.sessions[token];
  db.flushSoon();
}

function sessionValid(db, token) {
  const s = token && db.data.sessions[token];
  if (!s) return false;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    delete db.data.sessions[token];
    db.flushSoon();
    return false;
  }
  return true;
}

/** Middleware : protège les routes d'administration. */
function requireAdmin(db) {
  return (req, res, next) => {
    const token = req.cookies && req.cookies.sl_session;
    if (!sessionValid(db, token)) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    return next();
  };
}

/** Vérifie que la requête est bien un appel AJAX (protection CSRF minimale). */
function requireAjax(req, res, next) {
  const via = String(req.headers["x-requested-with"] || "");
  const origin = String(req.headers["origin"] || "");
  if (via === "XMLHttpRequest" || origin.toLowerCase().startsWith("http://localhost")) return next();
  return res.status(400).json({ error: "Requête non valide" });
}

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  createSession,
  destroySession,
  sessionValid,
  requireAdmin,
  requireAjax,
  SESSION_TTL_MS
};