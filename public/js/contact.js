"use strict";

// Page Contact : envoi du formulaire vers /api/contact.

async function envoyerMessage(e) {
  e.preventDefault();
  const alertBox = document.getElementById("contact-alert");
  if (alertBox) alertBox.innerHTML = "";

  const nom = document.getElementById("c-nom").value.trim();
  const telephone = document.getElementById("c-tel").value.trim();
  const email = document.getElementById("c-email").value.trim();
  const sujet = document.getElementById("c-sujet").value;
  const message = document.getElementById("c-message").value.trim();

  if (!nom || !message) {
    if (alertBox) alertBox.innerHTML = '<div class="alert error">Nom et message sont obligatoires.</div>';
    return;
  }

  const btn = e.target.querySelector("button[type=submit]");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Envoi…";
  }

  try {
    await api("/api/contact", {
      method: "POST",
      body: { nom, telephone, email, sujet, message }
    });
    if (alertBox) {
      alertBox.innerHTML = '<div class="alert success">✓ Message envoyé ! Nous vous répondrons rapidement.</div>';
    }
    e.target.reset();
  } catch (err) {
    if (alertBox) alertBox.innerHTML = '<div class="alert error">' + esc(err.message) + "</div>";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Envoyer le message";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const f = document.getElementById("form-contact");
  if (f) f.addEventListener("submit", envoyerMessage);
});