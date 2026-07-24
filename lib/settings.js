const { hashPin } = require("./auth");

const DEFAULT_SETTINGS = {
  shopName: "Wake Up Barber",
  tagline: "Fresh cuts. No alarm needed.",
  instagram: "wakeupbarber",
  address: "Long Island, NY",
  hoursStart: "09:00",
  hoursEnd: "19:00",
  closedDays: [0],
  services: ["Haircut", "Haircut + Beard", "Kids Cut", "Home Service (+$25)"],
  paymentLink: ""
};

function publicSettings(settings) {
  const s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  delete s.pin;
  delete s.pinHash;
  delete s.pinSalt;
  if (!Array.isArray(s.services)) s.services = DEFAULT_SETTINGS.services.slice();
  s.services = s.services.filter((x) => x !== "Beard Trim");
  if (!s.services.length) s.services = DEFAULT_SETTINGS.services.slice();
  if (!Array.isArray(s.closedDays)) s.closedDays = [0];
  return s;
}

async function loadSettings(redis) {
  const raw = (await redis.get("wub_settings")) || {};
  let settings = Object.assign({}, DEFAULT_SETTINGS, raw);

  // Migrate plaintext PIN → salted hash; never keep pin in Redis afterwards.
  if (!settings.pinHash || !settings.pinSalt) {
    const pin = settings.pin || "1234";
    const { salt, hash } = hashPin(pin);
    settings = Object.assign({}, settings, { pinHash: hash, pinSalt: salt });
    delete settings.pin;
    await redis.set("wub_settings", settings);
  } else if (settings.pin) {
    delete settings.pin;
    await redis.set("wub_settings", settings);
  }

  return settings;
}

function sanitizeSettingsUpdate(current, body) {
  const next = Object.assign({}, current);
  const src = body || {};
  if (typeof src.shopName === "string" && src.shopName.trim()) next.shopName = src.shopName.trim().slice(0, 80);
  if (typeof src.tagline === "string") next.tagline = src.tagline.trim().slice(0, 160);
  if (typeof src.instagram === "string") next.instagram = src.instagram.trim().replace(/^@/, "").slice(0, 64);
  if (typeof src.address === "string") next.address = src.address.trim().slice(0, 200);
  if (typeof src.hoursStart === "string" && /^\d{2}:\d{2}$/.test(src.hoursStart)) next.hoursStart = src.hoursStart;
  if (typeof src.hoursEnd === "string" && /^\d{2}:\d{2}$/.test(src.hoursEnd)) next.hoursEnd = src.hoursEnd;
  if (typeof src.paymentLink === "string") next.paymentLink = src.paymentLink.trim().slice(0, 300);
  if (Array.isArray(src.closedDays)) {
    next.closedDays = src.closedDays
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  }
  if (Array.isArray(src.services)) {
    next.services = src.services
      .filter((s) => typeof s === "string")
      .map((s) => s.trim().slice(0, 60))
      .filter(Boolean)
      .filter((s) => s !== "Beard Trim")
      .slice(0, 20);
    if (!next.services.length) next.services = DEFAULT_SETTINGS.services.slice();
  }

  if (typeof src.pin === "string" && src.pin.trim()) {
    const pin = src.pin.trim();
    if (!/^\d{4,6}$/.test(pin)) {
      const err = new Error("PIN must be 4–6 digits");
      err.status = 400;
      throw err;
    }
    const { salt, hash } = hashPin(pin);
    next.pinHash = hash;
    next.pinSalt = salt;
  }

  delete next.pin;
  return next;
}

module.exports = {
  DEFAULT_SETTINGS,
  publicSettings,
  loadSettings,
  sanitizeSettingsUpdate
};
