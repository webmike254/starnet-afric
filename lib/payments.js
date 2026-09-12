"use strict";

const crypto = require("crypto");

/**
 * Adaptateurs de paiement mobile money.
 *
 * IMPORTANT : cette maquette intègre le flux OFFICIEL des opérateurs —
 * la création d'une "intention de paiement" côté marchand est envoyée à la
 * passerelle officielle (Moov Money Africa, Orange Money, Airtel Money).
 * Vous avez obtenu vos accès marchands directement auprès d'eux ; renseignez
 * API_URL / MERCHANT_ID / API_KEY / WEBHOOK_SECRET dans le fichier .env.
 *
 * Le site ne demande JAMAIS le PIN ni le code OTP du client : seule
 * l'infrastructure officielle de l'opérateur les vérifie.
 */

const MODE = String(process.env.PAYMENT_MODE || "TEST").toUpperCase();

const PROVIDERS = {
  moov: {
    nom: "Moov Money",
    apiUrl: process.env.MOOV_API_URL,
    merchantId: process.env.MOOV_MERCHANT_ID,
    apiKey: process.env.MOOV_API_KEY,
    webhookSecret: process.env.MOOV_WEBHOOK_SECRET
  },
  orange: {
    nom: "Orange Money",
    apiUrl: process.env.ORANGE_API_URL,
    merchantId: process.env.ORANGE_MERCHANT_ID,
    apiKey: process.env.ORANGE_API_KEY,
    webhookSecret: process.env.ORANGE_WEBHOOK_SECRET
  },
  airtel: {
    nom: "Airtel Money",
    apiUrl: process.env.AIRTEL_API_URL,
    merchantId: process.env.AIRTEL_MERCHANT_ID,
    apiKey: process.env.AIRTEL_API_KEY,
    webhookSecret: process.env.AIRTEL_WEBHOOK_SECRET
  },
  mtn: {
    nom: "MTN MoMo",
    apiUrl: process.env.MTN_API_URL,
    merchantId: process.env.MTN_MERCHANT_ID,
    apiKey: process.env.MTN_API_KEY,
    webhookSecret: process.env.MTN_WEBHOOK_SECRET,
    sandboxMerchantCode: process.env.MTN_MERCHANT_CODE
  },
  mpesa: {
    nom: "Vodacom M-Pesa",
    apiUrl: process.env.MPESA_API_URL,
    merchantId: process.env.MPESA_MERCHANT_ID,
    apiKey: process.env.MPESA_API_KEY,
    webhookSecret: process.env.MPESA_WEBHOOK_SECRET
  }
};

function isEnabled(code) {
  const p = PROVIDERS[code];
  if (MODE === "TEST") return true; // en test tout est simulé
  return !!(p && p.apiUrl && p.merchantId && p.apiKey && p.webhookSecret);
}

function formatMontant(montant) {
  return Number(montant).toFixed(2);
}

/** Crée une intention de paiement pour une commande. */
async function initierPaiement(db, { order, provider, montant, devise, telephone }) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error("Moyen de paiement inconnu : " + provider);

  const reference = db.nextRef(); // servira aussi d'identifiant externe
  const payment = {
    ref: "PAY-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase(),
    provider,
    montant,
    devise,
    telephone,
    statut: MODE === "TEST" ? "en_attente" : "en_attente",
    creeLe: new Date().toISOString()
  };
  order.paiement = payment;

  if (MODE === "LIVE") {
    // ---- Intégration officielle (à compléter avec l'API exacte de l'opérateur) ----
    const payload = {
      merchant_id: p.merchantId,
      reference,
      amount: formatMontant(montant),
      currency: devise,
      phone: telephone,
      description: "Abonnement forfait Starlink — " + reference,
      notify_url: process.env.PAYMENT_BASE_URL + "/api/payments/webhook/" + provider,
      return_url: process.env.PAYMENT_BASE_URL + "/commandes.html?st=" + reference
    };
    const signature = crypto.createHmac("sha256", p.apiKey).update(JSON.stringify(payload)).digest("hex");

    // NOTE : l'endpoint exact, le format de réponse et l'auth HTTP (Bearer)
    // dépendent de la région et de la documentation fournie par l'opérateur.
    const resp = await fetch(p.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": signature },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error("Passerelle " + p.nom + " a refusé la demande (" + resp.status + ")");
    const data = await resp.json();

    payment.intention = {
      idPasserelle: data.transaction_id || data.id || "",
      statutPasserelle: data.status || data.statut || "pending"
    };
    payment.statut = "en_attente";
  }

  db.flushSoon();
  return { reference, paiement: payment };
}

/**
 * Webhook appelé par la passerelle officielle de l'opérateur.
 * Vérifie la signature avant de confirmer le paiement.
 */
function traiterWebhook(db, provider, body, signatureHeader) {
  const p = PROVIDERS[provider];
  if (!p || !p.webhookSecret || MODE === "TEST") {
    // En mode TEST la validation est manuelle ; le webhook reste simulable via l'admin.
    return { ok: false, erreur: "Webhook indisponible (mode TEST) — utilisez la validation manuelle dans l'admin." };
  }
  const expected = crypto.createHmac("sha256", p.webhookSecret).update(JSON.stringify(body)).digest("hex");
  const provided = String(signatureHeader || "");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, erreur: "Signature webhook invalide" };
  }

  const reference = body.reference || body.transaction_reference;
  const order = db.data.orders.find((o) => o.reference === reference);
  if (!order) return { ok: false, erreur: "Commande introuvable : " + reference };

  const success = /success|completed|confirmed|paid/i.test(String(body.status || ""));
  if (success) {
    order.paiement.statut = "confirme";
    order.statut = "payee";
    order.paiement.confirmeLe = new Date().toISOString();
    order.paiement.idPasserelle = body.transaction_id || order.paiement.idPasserelle;
  } else {
    order.paiement.statut = "echec";
    order.paiement.erreur = String(body.message || "Paiement non abouti").slice(0, 200);
  }
  db.flushSoon();
  return { ok: true, confirme: success, reference };
}

/** Validation manuelle par l'équipe, à partir des rapports officiels de l'opérateur. */
function confirmerManuellement(db, order) {
  if (!order) return false;
  order.paiement = order.paiement || {};
  order.paiement.statut = "confirme";
  order.paiement.confirmeLe = new Date().toISOString();
  order.paiement.validePar = "admin";
  order.statut = "payee";
  db.flushSoon();
  return true;
}

module.exports = { initierPaiement, traiterWebhook, confirmerManuellement, isEnabled, PROVIDERS, MODE };