
import {
  redis,
  requireDevice,
  requireSession,
  sendJson
} from "../_lib.js";

export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  try {

    // ==================================
    // ESP32 POST DATA
    // ==================================

    if (req.method === "POST") {

      const deviceId = await requireDevice(req);

      if (!deviceId) {
        return sendJson(res, 401, {
          success: false,
          error: "Unauthorized device"
        });
      }

      const body = req.body || {};

      const sensorError =
        body.sensor_error === true;

      const temperature =
        body.temperature === null
          ? null
          : Number(body.temperature);

      const humidity =
        body.humidity === null
          ? null
          : Number(body.humidity);

      const uptime = Number(body.uptime);

      if (
        !sensorError &&
        (
          !Number.isFinite(temperature) ||
          !Number.isFinite(humidity) ||
          temperature < -100 ||
          temperature > 150 ||
          humidity < 0 ||
          humidity > 100
        )
      ) {
        return sendJson(res, 400, {
          error: "Invalid sensor data"
        });
      }

      if (!Number.isFinite(uptime) || uptime < 0) {
        return sendJson(res, 400, {
          error: "Invalid uptime"
        });
      }

      const data = {
        deviceId,
        temperature: sensorError ? null : temperature,
        humidity: sensorError ? null : humidity,
        mode: String(body.mode || "UNKNOWN"),
        alarm_active:
          body.alarm_active === true,
        alarm_reason:
          typeof body.alarm_reason === "string"
            ? body.alarm_reason.slice(0, 150)
            : "",
        sensor_error: sensorError,
        status: sensorError
          ? "SENSOR ERROR"
          : body.alarm_active === true
            ? "ALARM"
            : "NORMAL",
        uptime,
        last_seen: Date.now()
      };

      await redis.set(
        `device:${deviceId}:data`,
        JSON.stringify(data)
      );

      return sendJson(res, 200, {
        success: true,
        message: "Data received",
        last_seen: data.last_seen
      });

    }

    // ==================================
    // WEBSITE GET DATA
    // ==================================

    if (req.method === "GET") {

      const deviceId = await requireSession(req);

      if (!deviceId) {
        return sendJson(res, 401, {
          error: "Login required"
        });
      }

      const stored = await redis.get(
        `device:${deviceId}:data`
      );

      let data = stored;

      if (typeof stored === "string") {
        try {
          data = JSON.parse(stored);
        } catch {
          data = null;
        }
      }

      return sendJson(res, 200, {
        success: true,
        deviceId,
        data
      });

    }

    res.setHeader("Allow", "GET, POST");

    return sendJson(res, 405, {
      error: "Method not allowed"
    });

  } catch (error) {

    console.error("DATA ERROR:", error);

    return sendJson(res, 500, {
      error: "Server error"
    });

  }

}
