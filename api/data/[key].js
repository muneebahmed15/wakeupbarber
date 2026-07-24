const { getRedis } = require("../../lib/redis");
const { setCors, send } = require("../../lib/http");

/**
 * Legacy open key-value API — locked down.
 * Use /api/public/bootstrap, /api/bookings, and /api/admin/* instead.
 */
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // Keep Redis probe for ops, but never expose or mutate data here.
  const redis = getRedis();
  if (!redis) {
    return send(res, 500, {
      error: "Redis not configured. Add Upstash Redis to this Vercel project, then redeploy."
    });
  }

  return send(res, 410, {
    error: "This endpoint is retired. Use /api/public/bootstrap, /api/bookings, or /api/admin/*."
  });
};
