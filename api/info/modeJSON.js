
import {
  redis,
  requireSession,
  requireDevice,
  sendJson
} from "../_lib.js";

const MODES = {
  FREEZER: {
    id: 0,
    temperature_min: -25,
    temperature_max: -18,
    humidity_min: 0,
    humidity_max: 90
  },
  CHILLER: {
    id: 1,
    temperature_min: 0,
    temperature_max: 5,
    humidity_min: 0,
    humidity_max: 90
  },
  GUDANG: {
    id: 2,
    temperature_min: 20,
    temperature_max: 40,
    humidity_min: 40,
    humidity_max: 90
  }
};

export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  try {

    // ==================================
    // GET MODE
    // ==================================

    if (req.method === "GET") {

      const deviceId = await requireDevice(req);

      if (!deviceId) {
        return sendJson(res, 401, {
          success: false,
          error: "Unauthorized device"
        });
      }

      const key = `device:${deviceId}:mode`;

      let mode = await redis.get(key);

      if (mode === null) {
        mode = "1";
        await redis.set(key, mode);
      }

      const modeId = Number(mode);

      const selected = Object.entries(MODES).find(
        ([name, value]) => value.id === modeId
      );

      if (!selected) {
        return sendJson(res, 500, {
          success: false,
          error: "Invalid stored mode"
        });
      }

      const [modeName, limits] = selected;

      return sendJson(res, 200, {
        success: true,
        deviceId,
        mode: modeName,
        mode_id: limits.id,
        temperature_min: limits.temperature_min,
        temperature_max: limits.temperature_max,
        humidity_min: limits.humidity_min,
        humidity_max: limits.humidity_max
      });

    }

    // ==================================
    // POST MODE
    // ==================================

    if (req.method === "POST") {

      const deviceId = await requireSession(req);

      if (!deviceId) {
        return sendJson(res, 401, {
          success: false,
          error: "Login required"
        });
      }

      const requestedMode = req.body?.mode;

      let selected = null;

      if (typeof requestedMode === "number") {
        selected = Object.entries(MODES).find(
          ([name, value]) => value.id === requestedMode
        );
      }

      if (typeof requestedMode === "string") {
        const name = requestedMode.toUpperCase();

        if (MODES[name]) {
          selected = [name, MODES[name]];
        }
      }

      if (!selected) {
        return sendJson(res, 400, {
          success: false,
          error: "Invalid mode"
        });
      }

      const [modeName, limits] = selected;

      await redis.set(
        `device:${deviceId}:mode`,
        String(limits.id)
      );

      return sendJson(res, 200, {
        success: true,
        deviceId,
        mode: modeName,
        mode_id: limits.id,
        temperature_min: limits.temperature_min,
        temperature_max: limits.temperature_max,
        humidity_min: limits.humidity_min,
        humidity_max: limits.humidity_max
      });

    }

    res.setHeader("Allow", "GET, POST");

    return sendJson(res, 405, {
      error: "Method not allowed"
    });

  } catch (error) {

    console.error("MODE ERROR:", error);

    return sendJson(res, 500, {
      error: "Server error"
    });

  }

}
