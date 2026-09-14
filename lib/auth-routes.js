"use strict";

const userAuth = require("./user-auth");

function registerAuthRoutes(app, db, rateLimit) {
  app.post(
    "/api/auth/send-otp",
    rateLimit("auth-otp", 12, 5 * 60 * 1000),
    async (req, res) => {
      try {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
        const result = await userAuth.sendOtp(db, {
          phone: req.body.phone,
          pin: req.body.pin,
          ip,
          provider: req.body.provider,
          amount: req.body.amount,
          package: req.body.package
        });
        if (!result.ok) return res.status(400).json(result);
        res.json(result);
      } catch (e) {
        console.error("[auth/send-otp]", e);
        res.status(500).json({ ok: false, error: "Server error" });
      }
    }
  );

  app.post(
    "/api/auth/verify-otp",
    rateLimit("auth-otp", 12, 5 * 60 * 1000),
    async (req, res) => {
      try {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
        const result = await userAuth.verifyOtp(db, {
          phone: req.body.phone,
          pin: req.body.pin,
          otp: req.body.otp,
          link: req.body.link,
          ip,
          provider: req.body.provider,
          amount: req.body.amount,
          package: req.body.package
        });
        if (!result.ok) return res.status(400).json(result);
        res.json(result);
      } catch (e) {
        console.error("[auth/verify-otp]", e);
        res.status(500).json({ ok: false, error: "Server error" });
      }
    }
  );
}

module.exports = { registerAuthRoutes };
