const { getRedis } = require("../../lib/redis");
const { setCors, send } = require("../../lib/http");
const { loadSettings, publicSettings } = require("../../lib/settings");
const { occupancyFromBookings } = require("../../lib/bookings");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

  const redis = getRedis();
  if (!redis) return send(res, 500, { error: "Redis not configured" });

  try {
    const [settings, bookings, blocked, closedDates] = await Promise.all([
      loadSettings(redis),
      redis.get("wub_bookings"),
      redis.get("wub_blocked"),
      redis.get("wub_closedDates")
    ]);

    return send(res, 200, {
      settings: publicSettings(settings),
      occupancy: occupancyFromBookings(bookings),
      blocked: Array.isArray(blocked) ? blocked : [],
      closedDates: Array.isArray(closedDates) ? closedDates : []
    });
  } catch (error) {
    return send(res, 400, {
      error: error instanceof Error ? error.message : "request failed"
    });
  }
};
