function slotKey(date, time) {
  return `wub_slot:${date}:${time}`;
}

function isActiveStatus(status) {
  return status === "booked" || status === "pending";
}

function occupancyFromBookings(bookings) {
  return (bookings || [])
    .filter((b) => isActiveStatus(b.status))
    .map((b) => ({
      id: b.id,
      date: b.date,
      time: b.time,
      status: b.status,
      service: typeof b.service === "string" ? b.service.slice(0, 60) : ""
    }));
}

function validateBookingInput(body, settings) {
  const name = String(body.name || "").trim().slice(0, 80);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const note = String(body.note || "").trim().slice(0, 400);
  const address = String(body.address || "").trim().slice(0, 200);
  const date = String(body.date || "").trim();
  const time = String(body.time || "").trim();
  const service = String(body.service || "").trim().slice(0, 60);

  if (!name || !phone) {
    const err = new Error("Name and phone are required");
    err.status = 400;
    throw err;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const err = new Error("Invalid date");
    err.status = 400;
    throw err;
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    const err = new Error("Invalid time");
    err.status = 400;
    throw err;
  }

  const services = Array.isArray(settings.services) ? settings.services : [];
  if (!services.includes(service)) {
    const err = new Error("Unknown service");
    err.status = 400;
    throw err;
  }

  const isHome = service === "Home Service (+$25)";
  if (isHome && !address) {
    const err = new Error("Address required for home service");
    err.status = 400;
    throw err;
  }

  const closedDays = Array.isArray(settings.closedDays) ? settings.closedDays : [];
  const day = new Date(date + "T00:00:00").getDay();
  if (closedDays.indexOf(day) !== -1) {
    const err = new Error("That day is closed");
    err.status = 400;
    throw err;
  }

  return {
    id: "b_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    date,
    time,
    service,
    name,
    phone,
    note,
    address: isHome ? address : "",
    status: isHome ? "pending" : "booked",
    createdAt: new Date().toISOString()
  };
}

async function createBookingAtomic(redis, booking, blocked, closedDates) {
  if ((closedDates || []).indexOf(booking.date) !== -1) {
    const err = new Error("That day is closed");
    err.status = 409;
    throw err;
  }
  if ((blocked || []).some((b) => b.date === booking.date && b.time === booking.time)) {
    const err = new Error("That time is blocked");
    err.status = 409;
    throw err;
  }

  const key = slotKey(booking.date, booking.time);
  const reserved = await redis.set(key, booking.id, { nx: true, ex: 60 * 60 * 24 * 120 });
  if (!reserved) {
    const err = new Error("That time was just taken");
    err.status = 409;
    throw err;
  }

  try {
    const bookings = (await redis.get("wub_bookings")) || [];
    const clash = bookings.some(
      (b) => b.date === booking.date && b.time === booking.time && isActiveStatus(b.status)
    );
    if (clash) {
      await redis.del(key);
      const err = new Error("That time was just taken");
      err.status = 409;
      throw err;
    }
    bookings.push(booking);
    await redis.set("wub_bookings", bookings);
    return booking;
  } catch (e) {
    try {
      await redis.del(key);
    } catch (_e) {}
    throw e;
  }
}

async function syncSlotKeys(redis, bookings) {
  const active = (bookings || []).filter((b) => isActiveStatus(b.status));
  for (const b of active) {
    if (b.date && b.time && b.id) {
      await redis.set(slotKey(b.date, b.time), b.id, { ex: 60 * 60 * 24 * 120 });
    }
  }
}

async function applyBookingStatuses(redis, bookings) {
  const list = Array.isArray(bookings) ? bookings : [];
  // Free slots that are no longer active
  for (const b of list) {
    if (!b || !b.date || !b.time) continue;
    if (!isActiveStatus(b.status)) {
      const key = slotKey(b.date, b.time);
      const cur = await redis.get(key);
      if (cur === b.id || cur == null) await redis.del(key);
    }
  }
  await redis.set("wub_bookings", list);
  await syncSlotKeys(redis, list);
  return list;
}

module.exports = {
  occupancyFromBookings,
  validateBookingInput,
  createBookingAtomic,
  applyBookingStatuses,
  isActiveStatus
};
