"use strict";

/**
 * Données initiales de la plateforme.
 * (Modifiables ensuite depuis le panneau d'administration.)
 */

const COUNTRIES = [
  { code: "CD", name: "RD Congo", lang: "fr", devise: "CDF" },
  { code: "CG", name: "Congo-Brazzaville", lang: "fr", devise: "FCFA" },
  { code: "GA", name: "Gabon", lang: "fr", devise: "FCFA" },
  { code: "TD", name: "Tchad", lang: "fr", devise: "FCFA" },
  { code: "NE", name: "Niger", lang: "fr", devise: "FCFA" },
  { code: "MG", name: "Madagascar", lang: "fr", devise: "MGA" },
  { code: "BI", name: "Burundi", lang: "fr", devise: "BIF" },
  { code: "KE", name: "Kenya", lang: "en", devise: "KSh" },
  { code: "UG", name: "Ouganda", lang: "en", devise: "UGX" },
  { code: "TZ", name: "Tanzanie", lang: "en", devise: "TZS" },
  { code: "RW", name: "Rwanda", lang: "en", devise: "RWF" },
  { code: "NG", name: "Nigéria", lang: "en", devise: "NGN" },
  { code: "GH", name: "Ghana", lang: "en", devise: "GHS" },
  { code: "ZM", name: "Zambie", lang: "en", devise: "ZMW" },
  { code: "MW", name: "Malawi", lang: "en", devise: "MWK" },
  { code: "ZW", name: "Zimbabwe", lang: "en", devise: "USD" },
  { code: "SL", name: "Sierra Leone", lang: "en", devise: "SLL" }
];

const PAYMENT_METHODS = [
  {
    code: "moov",
    nom: "Moov Money",
    description: "Payez avec votre portefeuille Moov Money",
    couleur: "#F35E00",
    texteCouleur: "#ffffff",
    active: true
  },
  {
    code: "orange",
    nom: "Orange Money",
    description: "Payez avec votre portefeuille Orange Money",
    couleur: "#FF7900",
    texteCouleur: "#ffffff",
    active: true
  },
  {
    code: "airtel",
    nom: "Airtel Money",
    description: "Payez avec votre portefeuille Airtel Money",
    couleur: "#E40000",
    texteCouleur: "#ffffff",
    active: true
  },
  {
    code: "mtn",
    nom: "MTN MoMo",
    description: "Payez avec votre portefeuille MTN Mobile Money",
    couleur: "#FFCC00",
    texteCouleur: "#1f2937",
    active: true
  },
  {
    code: "mpesa",
    nom: "Vodacom M-Pesa",
    description: "Payez avec votre portefeuille M-Pesa",
    couleur: "#D71920",
    texteCouleur: "#ffffff",
    active: true
  }
];

function packagesParDefaut() {
  return [
    {
      code: "decouverte",
      nom: "Forfait Découverte",
      description: "Parfait pour la navigation, la messagerie et les réseaux sociaux.",
      quantiteGo: 5,
      prix: 3000,
      prixPromo: 5000,
      devise: "CDF",
      type: "mensuel",
      populaire: false,
      actif: true,
      tags: ["Entrée de gamme"]
    },
    {
      code: "standard",
      nom: "Forfait Standard",
      description: "Idéal pour une famille : streaming, travail à distance et visioconférence.",
      quantiteGo: 15,
      prix: 5000,
      prixPromo: 8000,
      devise: "CDF",
      type: "mensuel",
      populaire: true,
      actif: true,
      tags: ["Populaire"]
    },
    {
      code: "standard-plus",
      nom: "Forfait Standard +",
      description: "Plus de données pour plusieurs appareils au quotidien.",
      quantiteGo: 30,
      prix: 8000,
      prixPromo: 12000,
      devise: "CDF",
      type: "mensuel",
      populaire: false,
      actif: true,
      tags: []
    },
    {
      code: "premium",
      nom: "Forfait Premium",
      description: "Grande consommation : streaming 4K, gaming, maison connectée.",
      quantiteGo: 60,
      prix: 12000,
      prixPromo: 30000,
      devise: "CDF",
      type: "mensuel",
      populaire: false,
      actif: true,
      tags: ["Données illimitées le soir"]
    },
    {
      code: "business",
      nom: "Forfait Business",
      description: "Pour les PME et équipes : priorité réseau et support dédié.",
      quantiteGo: 100,
      prix: 20000,
      prixPromo: 30000,
      devise: "CDF",
      type: "mensuel",
      populaire: false,
      actif: true,
      tags: ["Usage intensif", "Support prioritaire"]
    },
    {
      code: "kit-standard",
      nom: "Kit Starlink Standard",
      description: "Kit antenne + routeur WiFi (offre d'acquisition, une fois).",
      quantiteGo: 0,
      prix: 0,
      prixPromo: 0,
      devise: "USD",
      type: "kit",
      populaire: false,
      actif: true,
      tags: ["Installation incluse", "Sur devis"],
      note: "Prix selon votre pays — demandez un devis en commandant."
    }
  ];
}

function seedConfig(siteInfo) {
  return {
    site: {
      nom: "STARNÉT AFRIC",
      slogan: "Revendeur de forfaits Starlink en Afrique centrale",
      email: siteInfo.email || "support@starnetafric.com",
      telephone: siteInfo.telephone || "+243 000 000 000",
      whatsapp: siteInfo.whatsapp || "243900000000",
      adresse: siteInfo.adresse || "Kinshasa, RD Congo",
      anneesActivite: 3,
      clientsAcquis: 1200,
      paysServis: 8
    },
    reseau: {
      statut: "operational", // operational | degrade | maintenance
      message: "Le réseau Starlink fonctionne normalement dans votre zone.",
      misAJour: null,
      incident: null
    }
  };
}

function makeSeed({ adminUser, adminPassword, hashedAdmin, salt, siteInfo }) {
  return {
    version: 1,
    dateCreation: new Date().toISOString(),
    admin: {
      user: adminUser,
      passwordHash: hashedAdmin,
      salt
    },
    sessions: {},
    config: seedConfig(siteInfo),
    countries: COUNTRIES,
    paymentMethods: PAYMENT_METHODS,
    packages: packagesParDefaut(),
    orders: [],
    messages: [],
    visits: [],
    sequence: { order: 1000, contact: 100, payment: 5000 }
  };
}

module.exports = { makeSeed, COUNTRIES, PAYMENT_METHODS, packagesParDefaut };