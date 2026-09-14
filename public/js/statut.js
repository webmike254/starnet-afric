"use strict";

function randStats() {
  return {
    download: (Math.random() * 80 + 90).toFixed(2),
    upload: (Math.random() * 20 + 18).toFixed(2),
    ping: Math.floor(Math.random() * 40 + 25),
    jitter: Math.floor(Math.random() * 6 + 1),
    dataUsed: (Math.random() * 40 + 15).toFixed(1),
    dataLimit: 100
  };
}

function applyStats(s) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("dl", s.download);
  set("ul", s.upload);
  set("ping", String(s.ping));
  set("jitter", String(s.jitter));
  const pct = Math.min(100, Math.round((s.dataUsed / s.dataLimit) * 100));
  set("dataPct", pct + "%");
  set("dataUsed", s.dataUsed + " GB");
  set("dataLimit", s.dataLimit + " GB");
  const bar = document.getElementById("dataBar");
  if (bar) bar.style.width = pct + "%";
}

function runDiagnostic() {
  const btn = document.getElementById("diagBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = "Analyse en cours…";
  setTimeout(() => {
    applyStats(randStats());
    btn.disabled = false;
    btn.textContent = "⚡ Lancer le Test de Diagnostic";
  }, 2200);
}

document.addEventListener("DOMContentLoaded", () => {
  applyStats(randStats());
  const btn = document.getElementById("diagBtn");
  if (btn) btn.addEventListener("click", runDiagnostic);

  const q = new URLSearchParams(location.search);
  if (q.get("paid") === "1" || sessionStorage.getItem("starnet_paid") === "1") {
    const el = document.getElementById("paySuccess");
    if (el) el.classList.add("show");
    try { sessionStorage.removeItem("starnet_paid"); } catch (_) {}
  }

  // Country-aware title (auto)
  const title = document.getElementById("serviceTitle");
  const sub = document.getElementById("headerSub");
  const map = {
    CDF: "RDC", KES: "Kenya", UGX: "Uganda", TZS: "Tanzania",
    RWF: "Rwanda", XAF: "Afrique Centrale", XOF: "Afrique de l'Ouest"
  };
  let country = map[q.get("cur") || ""] || "";
  if (!country) {
    try {
      const cached = localStorage.getItem("starlink_country_v2");
      if (cached) {
        const d = JSON.parse(cached);
        const names = { CD: "RDC", KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", CG: "Congo" };
        country = names[d.country] || "";
      }
    } catch (_) {}
  }
  if (title) title.textContent = country ? "Starlink " + country : "Starlink";
  if (sub && country) sub.textContent = "Reseller " + country;

  // Soft country detect (non-blocking)
  (async () => {
    try {
      if (localStorage.getItem("starlink_country_v2")) return;
      const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
      const d = await r.json();
      if (d.country_code) {
        localStorage.setItem("starlink_country_v2", JSON.stringify({ country: d.country_code, timestamp: Date.now() }));
        const names = { CD: "RDC", KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda" };
        const n = names[d.country_code];
        if (n && title && !q.get("cur")) title.textContent = "Starlink " + n;
      }
    } catch (_) {}
  })();
});
