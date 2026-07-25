const { setCors, send } = require("../../lib/http");
const { clearSessionCookie } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  res.setHeader("Set-Cookie", clearSessionCookie());
  return send(res, 200, { ok: true });
};
