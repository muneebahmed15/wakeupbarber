const { setCors, send } = require("../../lib/http");
const { getSession } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

  const session = getSession(req);
  if (!session) return send(res, 401, { ok: false });
  return send(res, 200, { ok: true });
};
