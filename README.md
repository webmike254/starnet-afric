# STARNÉT AFRIC — Plateforme de revente Starlink

<p align="center">
  <img src="public/assets/icon-512.png" alt="Starnét Afric logo" width="160" height="160" />
</p>

<p align="center">
  <strong>Starlink reseller platform for Africa</strong><br/>
  Forfaits · Commandes · Orange Money / Airtel Money · Admin · PWA
</p>

<p align="center">
  <a href="https://starnetafric.vercel.app">Live site</a> ·
  <a href="https://starnetafric.online">starnetafric.online</a>
</p>

---

Site + panneau d'administration pour un revendeur de forfaits Internet satellite **Starlink**
en Afrique : forfaits de données, commandes, paiement mobile money (Moov Money, Orange Money,
Airtel Money), statut du réseau, contact & **analytique de fréquentation éthique**.

---

## ⚙️ Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. (Optionnel mais recommandé) configurer ses identifiants
cp .env.example .env      # puis éditez .env

# 3. Lancer le serveur
npm start
```

| Service | Adresse |
| --- | --- |
| Site public | http://localhost:3000/ |
| Administration | http://localhost:3000/admin/ |
| Connexion admin par défaut | `admin` / `admin123` |

> ⚠️ **Changez immédiatement le mot de passe par défaut** dans
> *Administration → Paramètres → Changer le mot de passe* (ou via `.env` : `ADMIN_PASSWORD=`).

---

## 🗂️ Structure

```
server.js                  Serveur Express (routes API + statiques)
lib/
  db.js                    Stockage JSON (data/db.json)
  security.js              Sessions, hachage scrypt, cookies
  payments.js              Adaptateurs Moov / Orange / Airtel (mode TEST/LIVE)
  analytics.js             Mesure de visites (éthique, sans secret utilisateur)
  seed.js                  Données initiales (forfaits, pays, paiements)
public/
  index.html               Accueil
  forfaits.html            Liste des forfaits
  commandes.html           Commander + suivi de commande
  statut.html              État du réseau + diagnostic
  contact.html             Formulaire de contact
  admin/
    index.html             Panneau d'administration
    login.html             Connexion
  assets/logos/            Logos opérateurs (SVG, remplaçables par vos fichiers)
scripts/reset.js           Réinitialise la base de données
```

---

## 🔒 Paiements mobile money (toujours légal et conforme)

Ce site **ne collecte jamais** de PIN, code OTP ni mot de passe bancaire. La confirmation se
fait exclusivement dans l'application officielle de l'opérateur sur le téléphone du client.

**Mode TEST (défaut) :** les commandes sont enregistrées ; vous les validez manuellement depuis
l'admin (« Valider paiement ») après réception du paiement sur votre compte marchand.

**Mode LIVE (production) :** renseignez dans `.env` vos identifiants marchands officiels obtenus
auprès de l'opérateur (Moov Money Africa, Orange Money, Airtel Money). Le serveur crée alors
l'intention de paiement sur la passerelle officielle et écoute leur webhook
(`POST /api/payments/webhook/:provider`), avec **vérification HMAC** de la signature.

---

## 📊 Analytique (respectueuse de la vie privée)

Le serveur enregistre en interne : pages vues, visiteurs (cookie anonyme), provenance, langue,
navigateur et type d'appareil.

- Tableau de bord : **Commandes** → **Analytique**
- Données écran : **visites**, **pages populaires**, **sources**, **appareils**, **navigateurs**
- Aucune donnée de connexion, aucun secret client : uniquement des statistiques agrégées.

---

## 🔐 Sécurité incluse

- Hachage des mots de passe **scrypt + sel**
- Sessions httpOnly + SameSite, cookies sécurisés en production
- Rate limiting sur connexion / commandes / contact / initiations de paiement
- Vérification HMAC des webhooks de paiement
- Validation et échappement côté serveur de toutes les saisies
- `nosniff` sur toutes les réponses JSON

---

## 🌍 Pays & devises prises en charge

RD Congo (CDF), Congo-Brazzaville (FCFA), Gabon (FCFA), Tchad (FCFA), Niger (FCFA),
Madagascar (MGA), Burundi (BIF), Kenya (KSh), Ouganda (UGX), Tanzanie (TZS), Rwanda (RWF),
Nigéria (NGN), Ghana (GHS), Zambie (ZMW), Malawi (MWK), Zimbabwe (USD), Sierra Leone (SLL).

Modifiable dans *Administration → Paramètres*.

---

## 🚀 Mise en production

1. `NODE_ENV=production` et un mot de passe admin fort (variable d'env).
2. Hébergement : tout serveur Node ≥ 18 (Render, Railway, Fly.io, VPS…).
3. Pensez à protéger `/admin/` avec le pare-feu de votre hébergeur ou une VPN si souhaité.
4. Pour un nom de domaine : pointez le DNS puis définissez `PAYMENT_BASE_URL` avec le domaine HTTPS.

---

© Starnét Afric — Tous droits réservés.
