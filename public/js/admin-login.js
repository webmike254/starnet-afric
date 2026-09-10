"use strict";

// Connexion administrateur.

async function login(e) {
  e.preventDefault();
  const alertBox = document.getElementById("login-alert");
  if (alertBox) alertBox.innerHTML = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    if (alertBox) alertBox.innerHTML = '<div class="alert error">Identifiant et mot de passe requis.</div>';
    return;
  }

  const btn = e.target.querySelector("button");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Connexion…";
  }

  try {
    await api("/api/admin/login", {
      method: "POST",
      body: { username, password }
    });
    window.location.href = "/admin/";
  } catch (err) {
    if (alertBox) alertBox.innerHTML = '<div class="alert error">' + esc(err.message) + "</div>";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Se connecter";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const f = document.getElementById("form-login");
  if (f) f.addEventListener("submit", login);
});