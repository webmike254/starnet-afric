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
    },
    {
      code: "starter",
      nom: "Forfait Starter",
      description: "Idéal pour commencer en toute sérénité.",
      quantiteGo: 120,
      prix: 30000,
      prixPromo: 42000,
      devise: "CDF",
      type: "bundle",
      periode: "2mois",
      couleur: "vert",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Économique"]
    },
    {
      code: "avance",
      nom: "Forfait Avancé",
      description: "Le meilleur rapport qualité-prix sur 2 mois.",
      quantiteGo: 250,
      prix: 50000,
      prixPromo: 70000,
      devise: "CDF",
      type: "bundle",
      periode: "2mois",
      couleur: "bleu",
      populaire: true,
      actif: true,
      tags: ["Données illimitées", "Meilleur rapport"]
    },
    {
      code: "elite",
      nom: "Forfait Élite",
      description: "Streaming HD intensif pendant 2 mois.",
      quantiteGo: 400,
      prix: 75000,
      prixPromo: 105000,
      devise: "CDF",
      type: "bundle",
      periode: "2mois",
      couleur: "violet",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Streaming HD"]
    },
    {
      code: "pro600",
      nom: "Forfait Pro",
      description: "Usage intensif sur 3 mois.",
      quantiteGo: 600,
      prix: 100000,
      prixPromo: 140000,
      devise: "CDF",
      type: "bundle",
      periode: "3mois",
      couleur: "cyan",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Usage intensif"]
    },
    {
      code: "business1tb",
      nom: "Forfait Business",
      description: "Pour entreprises avec support prioritaire.",
      quantiteGo: 1000,
      prix: 150000,
      prixPromo: 210000,
      devise: "CDF",
      type: "bundle",
      periode: "3mois",
      couleur: "indigo",
      populaire: false,
      actif: true,
      tags: ["Données illimitées", "Entreprise", "Support prioritaire"]
    },
    {
      code: "illimite",
      nom: "Forfait Illimité",
      description: "Le grand format : illimité, VIP, IP statique.",
      quantiteGo: 0,
      prix: 250000,
      prixPromo: 350000,
      devise: "CDF",
      type: "bundle",
      periode: "3mois",
      couleur: "orange",
      populaire: false,
      actif: true,
      tags: ["Illimité 24/7", "Support VIP", "IP statique"]
    },
    {
      code: "kit-standard",
      nom: "Kit Starlink Standard",
      description: "Kit antenne + routeur WiFi (acquisition, une fois).",
      quantiteGo: 0,
      prix: 0,
      prixPromo: 0,
      devise: "USD",
      type: "kit",
      periode: null,
      couleur: "orange",
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