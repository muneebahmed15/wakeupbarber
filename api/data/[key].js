const { Redis } = require("@upstash/redis");

const ALLOWED_KEYS = new Set([
  "wub_settings",
  "wub_bookings",
  "wub_blocked",
  "wub_closedDates"
]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const key = req.query.key;

  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: "unknown key" });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({
      error:
        "Redis not configured. Add Upstash Redis (KV) to this Vercel project, then redeploy."
    });
  }

  try {
    if (req.method === "GET") {
      const value = await redis.get(key);
      return res.status(200).json(value === undefined ? null : value);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(key, body);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "request failed"
    });
  }
};
