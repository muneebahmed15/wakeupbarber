const { getRedis } = require("../../lib/redis");
const { setCors, readJson, send } = require("../../lib/http");
const { requireAdmin } = require("../../lib/auth");
const { loadSettings, publicSettings, sanitizeSettingsUpdate } = require("../../lib/settings");
const { applyBookingStatuses } = require("../../lib/bookings");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!requireAdmin(req, res)) return;

  const redis = getRedis();
  if (!redis) return send(res, 500, { error: "Redis not configured" });

  try {
    if (req.method === "GET") {
      const [settings, bookings, blocked, closedDates] = await Promise.all([
        loadSettings(redis),
        redis.get("wub_bookings"),
        redis.get("wub_blocked"),
        redis.get("wub_closedDates")
      ]);
      return send(res, 200, {
        settings: publicSettings(settings),
        bookings: Array.isArray(bookings) ? bookings : [],
        blocked: Array.isArray(blocked) ? blocked : [],
        closedDates: Array.isArray(closedDates) ? closedDates : []
      });
    }

    if (req.method === "PUT") {
      const body = readJson(req);

      if (body.bookings !== undefined) {
        if (!Array.isArray(body.bookings)) return send(res, 400, { error: "bookings must be an array" });
        if (body.bookings.length > 5000) return send(res, 400, { error: "too many bookings" });
        await applyBookingStatuses(redis, body.bookings);
      }

      if (body.blocked !== undefined) {
        if (!Array.isArray(body.blocked)) return send(res, 400, { error: "blocked must be an array" });
        const blocked = body.blocked
          .filter((b) => b && typeof b.date === "string" && typeof b.time === "string")
          .map((b) => ({ date: b.date.slice(0, 10), time: b.time.slice(0, 5) }))
          .slice(0, 5000);
        await redis.set("wub_blocked", blocked);
      }

      if (body.closedDates !== undefined) {
        if (!Array.isArray(body.closedDates)) return send(res, 400, { error: "closedDates must be an array" });
        const closedDates = body.closedDates
          .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .slice(0, 1000);
        await redis.set("wub_closedDates", closedDates);
      }

      if (body.settings !== undefined) {
        const current = await loadSettings(redis);
        const next = sanitizeSettingsUpdate(current, body.settings);
        await redis.set("wub_settings", next);
      }

      const [settings, bookings, blocked, closedDates] = await Promise.all([
        loadSettings(redis),
        redis.get("wub_bookings"),
        redis.get("wub_blocked"),
        redis.get("wub_closedDates")
      ]);

      return send(res, 200, {
        ok: true,
        settings: publicSettings(settings),
        bookings: Array.isArray(bookings) ? bookings : [],
        blocked: Array.isArray(blocked) ? blocked : [],
        closedDates: Array.isArray(closedDates) ? closedDates : []
      });
    }

    return send(res, 405, { error: "method not allowed" });
  } catch (error) {
    return send(res, error.status || 400, {
      error: error instanceof Error ? error.message : "request failed"
    });
  }
};
