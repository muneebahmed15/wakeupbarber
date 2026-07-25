const { getRedis } = require("../../lib/redis");
const { setCors, readJson, send } = require("../../lib/http");
const { verifyPin, createSessionCookie } = require("../../lib/auth");
const { loadSettings } = require("../../lib/settings");
const { rateLimit, clientIp } = require("../../lib/rateLimit");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  const redis = getRedis();
  if (!redis) return send(res, 500, { error: "Redis not configured" });

  const ip = clientIp(req);
  const ok = await rateLimit(redis, `login:${ip}`, 20, 60 * 15);
  if (!ok) return send(res, 429, { error: "Too many attempts. Try again later." });

  try {
    const body = readJson(req);
    const pin = String(body.pin || "").trim();
    if (!/^\d{4,6}$/.test(pin)) return send(res, 400, { error: "Invalid PIN" });

    const settings = await loadSettings(redis);
    const valid = verifyPin(pin, settings.pinSalt, settings.pinHash);
    if (!valid) return send(res, 401, { error: "Wrong PIN" });

    const session = createSessionCookie();
    res.setHeader("Set-Cookie", session.header);
    return send(res, 200, { ok: true });
  } catch (error) {
    return send(res, error.status || 400, {
      error: error instanceof Error ? error.message : "login failed"
    });
  }
};
