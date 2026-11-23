import {
  redis,
  requireSession,
  requireDevice,
  sendJson
} from "../_lib.js";

const MODES = {
  FREEZER: { id: 0, temperature_min: -25, temperature_max: -18, humidity_min: 0, humidity_max: 90 },
  CHILLER: { id: 1, temperature_min: 0, temperature_max: 5, humidity_min: 0, humidity_max: 90 },
  GUDANG: { id: 2, temperature_min: 20, temperature_max: 40, humidity_min: 40, humidity_max: 90 }
};


async function resolveMode(req) {
  const sessionDevice = await requireSession(req);
  if (sessionDevice) return sessionDevice;
  return await requireDevice(req);
}


function modePayload(deviceId, modeId) {
  const selected = Object.entries(MODES).find(([, value]) => value.id === modeId);
  if (!selected) return null;
  const [modeName, limits] = selected;
  return {
    success: true, deviceId, mode: modeName, mode_id: limits.id,
    temperature_min: limits.temperature_min,
    temperature_max: limits.temperature_max,
    humidity_min: limits.humidity_min,
    humidity_max: limits.humidity_max
  };
}


export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const deviceId = await resolveMode(req);
      if (!deviceId) return sendJson(res, 401, { success: false, error: "Login/device authentication required" });
      const key = `device:${deviceId}:mode`;
      let stored = await redis.get(key);
      if (stored === null) { stored = "1"; await redis.set(key, stored); }
      const payload = modePayload(deviceId, Number(stored));
      if (!payload) return sendJson(res, 500, { success: false, error: "Invalid stored mode" });
      return sendJson(res, 200, payload);
    }

    if (req.method === "POST") {
      // Website session and ESP32 device credentials are both accepted here.
      const deviceId = await resolveMode(req);
      if (!deviceId) return sendJson(res, 401, { success: false, error: "Login/device authentication required" });
      const requested = req.body?.mode;
      let selected = null;
      if (typeof requested === "number") selected = Object.entries(MODES).find(([, value]) => value.id === requested);
      if (typeof requested === "string") {
        const name = requested.toUpperCase();
        if (MODES[name]) selected = [name, MODES[name]];
      }
      if (!selected) return sendJson(res, 400, { success: false, error: "Invalid mode" });
      const [name, limits] = selected;
      await redis.set(`device:${deviceId}:mode`, String(limits.id));
      return sendJson(res, 200, {
        success: true, deviceId, mode: name, mode_id: limits.id,
        temperature_min: limits.temperature_min, temperature_max: limits.temperature_max,
        humidity_min: limits.humidity_min, humidity_max: limits.humidity_max
      });
    }
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("MODE ERROR:", error);
    return sendJson(res, 500, { error: "Server error" });
  }
}
