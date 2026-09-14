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
  const dl = document.getElementById("dl");
  const ul = document.getElementById("ul");
  const ping = document.getElementById("ping");
  const jitter = document.getElementById("jitter");
  if (dl) dl.textContent = s.download;
  if (ul) ul.textContent = s.upload;
  if (ping) ping.textContent = String(s.ping);
  if (jitter) jitter.textContent = String(s.jitter);
  const pct = Math.min(100, Math.round((s.dataUsed / s.dataLimit) * 100));
  const dataPct = document.getElementById("dataPct");
  const dataBar = document.getElementById("dataBar");
  const dataUsed = document.getElementById("dataUsed");
  const dataLimit = document.getElementById("dataLimit");
  if (dataPct) dataPct.textContent = pct + "%";
  if (dataBar) dataBar.style.width = pct + "%";
  if (dataUsed) dataUsed.textContent = s.dataUsed + " GB";
  if (dataLimit) dataLimit.textContent = s.dataLimit + " GB";
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

  // After payment verification redirect
  const q = new URLSearchParams(location.search);
  if (q.get("paid") === "1" || sessionStorage.getItem("starnet_paid") === "1") {
    const el = document.getElementById("paySuccess");
    if (el) el.classList.add("show");
    try { sessionStorage.removeItem("starnet_paid"); } catch (_) {}
  }

  // Country label
  const title = document.getElementById("serviceTitle");
  if (title) {
    const cur = q.get("cur") || "";
    if (cur === "KES") title.textContent = "Starlink Kenya";
    else if (cur === "CDF") title.textContent = "Starlink RDC";
    else title.textContent = "Starlink";
  }
});
