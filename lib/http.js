function allowedOrigin(req) {
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const candidates = [
    process.env.APP_ORIGIN,
    host ? `https://${host}` : "",
    host ? `http://${host}` : "",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ].filter(Boolean);

  if (origin && candidates.some((c) => c === origin)) return origin;
  return "";
}

function setCors(req, res) {
  const origin = allowedOrigin(req);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function readJson(req) {
  if (req.body == null || req.body === "") return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_e) {
      const err = new Error("invalid json");
      err.status = 400;
      throw err;
    }
  }
  return req.body;
}

function send(res, status, data) {
  return res.status(status).json(data);
}

module.exports = { setCors, readJson, send, allowedOrigin };
