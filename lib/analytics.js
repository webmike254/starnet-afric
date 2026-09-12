"use strict";

const COOKIE_NAME = "slv";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

const CRAWLER_RE = /bot|crawl|spider|slurp|monitor|preview|uptime|pingdom|curl|wget|python|node-fetch/i;
// Les pages HTML sont EXCLUSES de cette liste : elles doivent être mesurées.
// Ne sont exclus que les actifs statiques (css, js, images, polices, manifest…).
const STATIC_RE = /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json|txt|map|xml|webmanifest)$/i;

function pseudoVisitorId() {
  return "v" + Buffer.from(cryptoRandom(9)).toString("base64url");
}

function cryptoRandom(n) {
  const crypto = require("crypto");
  return crypto.randomBytes(n);
}

function summarizeUa(ua) {
  ua = String(ua || "");
  let browser = "Autre";
  if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua)) browser = "Safari";
  else if (/opera|opr\//i.test(ua)) browser = "Opera";

  let device = "Ordinateur";
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    device = /tablet|ipad/i.test(ua) ? "Tablette" : "Mobile";
  }

  return { browser, device };
}

/**
 * Enregistre une visite directement (utilisé par le beacon /api/visit
 * quand les pages sont servies par le CDN sans passer par Express).
 */
function recordVisit(db, { vid, path, referrer, ua }) {
  const labels = summarizeUa(ua);
  const finalVid = vid || pseudoVisitorId();
  db.data.visits.push({
    id: db.data.visits.length + 1,
    ts: new Date().toISOString(),
    vid: finalVid,
    path: String(path || "/").slice(0, 200),
    referrer: String(referrer || "direct").slice(0, 300),
    lang: "",
    browser: labels.browser,
    device: labels.device
  });
  const cut = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
  while (db.data.visits.length && db.data.visits[0].ts < cut) db.data.visits.shift();
  db.flushSoon();
  return finalVid;
}

/** Middleware : enregistre une visite (hors API/statique/bots). */
function analyticsMiddleware(db) {
  return (req, res, next) => {
    const pathname = req.path;
    try {
      const ua = String(req.headers["user-agent"] || "");
      const isStatic = STATIC_RE.test(pathname);
      const isApi = pathname.startsWith("/api/") || pathname.startsWith("/admin/");
      const isBot = CRAWLER_RE.test(ua);

      let visitorId = "";
      const parse = req.headers.cookie || "";
      const m = parse.match(new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]+)"));
      if (m) visitorId = m[1];

      if (!isApi && !isStatic && !isBot && !pathname.endsWith("/favicon.ico")) {
        if (!visitorId) {
          visitorId = pseudoVisitorId();
          res.cookie(COOKIE_NAME, visitorId, {
            maxAge: COOKIE_MAX_AGE,
            httpOnly: true,
            sameSite: "Lax",
            path: "/"
          });
        }
        const labels = summarizeUa(ua);
        db.data.visits.push({
          id: db.data.visits.length + 1,
          ts: new Date().toISOString(),
          vid: visitorId,
          path: pathname.slice(0, 200),
          referrer: String(req.headers.referer || req.headers.referrer || "direct").slice(0, 300),
          lang: String(req.headers["accept-language"] || "").slice(0, 60),
          browser: labels.browser,
          device: labels.device
        });
        // Garde-fou : on conserve au maximum les 60 derniers jours de données brutes.
        const cut = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
        while (db.data.visits.length && db.data.visits[0].ts < cut) db.data.visits.shift();
        db.flushSoon();
      }
    } catch (_) {
      /* l'analytique ne doit jamais faire tomber le site */
    }
    return next();
  };
}

function visitsInRange(db, days) {
  const from = Date.now() - days * 1000 * 60 * 60 * 24;
  return db.data.visits.filter((v) => Date.parse(v.ts) >= from);
}

function countUnique(db, list) {
  return new Set(list.map((v) => v.vid)).size;
}

function isoDay(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Feuille de route journalière pour les N derniers jours. */
function series(db, days) {
  const map = {};
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString().slice(0, 10);
    map[d] = { jour: d, visites: 0, visiteurs: new Set() };
    out.push(map[d]);
  }
  for (const v of db.data.visits) {
    const d = isoDay(v.ts);
    if (map[d]) {
      map[d].visites++;
      map[d].visiteurs.add(v.vid);
    }
  }
  return out.map((o) => ({ jour: o.jour, visites: o.visites, visiteurs: o.visiteurs.size }));
}

/** « Pages vues » et autres synthèses sur une fenêtre donnée. */
function topBy(db, field, days, limit = 8) {
  const counts = {};
  const from = Date.now() - days * 1000 * 60 * 60 * 24;
  for (const v of db.data.visits) {
    if (Date.parse(v.ts) < from) continue;
    const key = v[field] || "inconnu";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, n]) => ({ clef: k, n }));
}

function summary(db) {
  const total = db.data.visits.length;
  const today = isoDay(Date.now());
  const todayVisits = db.data.visits.filter((v) => isoDay(v.ts) === today).length;
  const last7 = visitsInRange(db, 7);
  const last30 = visitsInRange(db, 30);

  return {
    totalVisites: total,
    visitesAujourdhui: todayVisits,
    visiteurs7j: countUnique(db, last7),
    visites7j: last7.length,
    visiteurs30j: countUnique(db, last30),
    visites30j: last30.length,
    serie14j: series(db, 14),
    pagesPopulaires: topBy(db, "path", 30),
    referers: topBy(db, "referrer", 30),
    navigateurs: topBy(db, "browser", 30),
    appareils: topBy(db, "device", 30),
    langues: topBy(db, "lang", 30),
    derniers:
      db.data.visits.slice(-10).reverse().map((v) => ({
        ts: v.ts,
        path: v.path,
        referrer: (v.referrer || "direct").slice(0, 80),
        browser: v.browser,
        device: v.device,
        lang: v.lang.slice(0, 20)
      }))
  };
}

module.exports = { analyticsMiddleware, summary, recordVisit, COOKIE_NAME };