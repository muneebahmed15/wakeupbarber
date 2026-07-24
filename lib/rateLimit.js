async function rateLimit(redis, bucket, limit, windowSec) {
  if (!redis) return true;
  const key = `wub_rl:${bucket}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

module.exports = { rateLimit, clientIp };
