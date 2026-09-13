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
  }
];

function packagesParDefaut() {
  return [
    {
      code: "decouverte",
      nom: "Forfait Basique",
      description: "Navigation, messagerie et réseaux sociaux.",
      quantiteGo: 5,
      prix: 3000,
      prixPromo: 5000,
      devise: "CDF",
      type: "mensuel",
      periode: "mois",
      couleur: "vert",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Économique"]
    },
    {
      code: "standard",
      nom: "Forfait Standard",
      description: "Streaming, travail à distance et visioconférence.",
      quantiteGo: 15,
      prix: 5000,
      prixPromo: 8000,
      devise: "CDF",
      type: "mensuel",
      periode: "mois",
      couleur: "bleu",
      populaire: true,
      actif: true,
      tags: ["Données illimitées", "Meilleur rapport"]
    },
    {
      code: "premium",
      nom: "Forfait Premium",
      description: "Streaming HD et gros volumes au quotidien.",
      quantiteGo: 30,
      prix: 8000,
      prixPromo: 12000,
      devise: "CDF",
      type: "mensuel",
      periode: "mois",
      couleur: "violet",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Streaming HD"]
    },
    {
      code: "pro",
      nom: "Forfait Pro",
      description: "Usage intensif et plusieurs appareils.",
      quantiteGo: 60,
      prix: 12000,
      prixPromo: 18000,
      devise: "CDF",
      type: "mensuel",
      periode: "mois",
      couleur: "indigo",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Usage intensif"]
    },
    {
      code: "business",
      nom: "Forfait Business",
      description: "Pour les PME et équipes.",
      quantiteGo: 100,
      prix: 20000,
      prixPromo: 30000,
      devise: "CDF",
      type: "mensuel",
      periode: "mois",
      couleur: "gris",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Entreprise"]
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