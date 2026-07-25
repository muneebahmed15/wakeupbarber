const crypto = require("crypto");

const COOKIE = "wub_admin_session";
const MAX_AGE_SEC = 60 * 60 * 12; // 12 hours

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "dev-insecure-change-me"
  );
}

function hashPin(pin, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), useSalt, 32).toString("hex");
  return { salt: useSalt, hash };
}

function verifyPin(pin, salt, hash) {
  if (!pin || !salt || !hash) return false;
  try {
    const next = crypto.scryptSync(String(pin), salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (next.length !== expected.length) return false;
    return crypto.timingSafeEqual(next, expected);
  } catch (_e) {
    return false;
  }
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ||
      sig.length !== expected.length
    ) {
      return null;
    }
  } catch (_e) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try {
      out[k] = decodeURIComponent(v);
    } catch (_e) {
      out[k] = v;
    }
  });
  return out;
}

function getSession(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE]);
}

function requireAdmin(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return session;
}

function createSessionCookie() {
  const token = signSession({ role: "admin", exp: Date.now() + MAX_AGE_SEC * 1000 });
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return {
    token,
    header: `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SEC}${secure}`
  };
}

function clearSessionCookie() {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

module.exports = {
  COOKIE,
  hashPin,
  verifyPin,
  getSession,
  requireAdmin,
  createSessionCookie,
  clearSessionCookie
};
