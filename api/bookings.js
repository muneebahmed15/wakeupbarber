const { getRedis } = require("../lib/redis");
const { setCors, readJson, send } = require("../lib/http");
const { loadSettings } = require("../lib/settings");
const { validateBookingInput, createBookingAtomic } = require("../lib/bookings");
const { rateLimit, clientIp } = require("../lib/rateLimit");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  const redis = getRedis();
  if (!redis) return send(res, 500, { error: "Redis not configured" });

  const ip = clientIp(req);
  const ok = await rateLimit(redis, `book:${ip}`, 30, 60 * 60);
  if (!ok) return send(res, 429, { error: "Too many booking attempts. Try again later." });

  try {
    const body = readJson(req);
    const settings = await loadSettings(redis);
    const blocked = (await redis.get("wub_blocked")) || [];
    const closedDates = (await redis.get("wub_closedDates")) || [];
    const booking = validateBookingInput(body, settings);
    const saved = await createBookingAtomic(redis, booking, blocked, closedDates);
    return send(res, 201, { ok: true, booking: saved });
  } catch (error) {
    return send(res, error.status || 400, {
      error: error instanceof Error ? error.message : "booking failed"
    });
  }
};
