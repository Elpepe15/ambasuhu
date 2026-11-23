
import {
  verifyDeviceRequest,
  verifySession
} from "../_lib/auth.js";

import {
  redis,
  deviceKey
} from "../_lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    let id;

    if (req.method === "POST") {
      id = await verifyDeviceRequest(req);
    } else if (req.method === "GET") {
      id = await verifySession(req);
    } else {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    if (!id) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const temperature = Number(body.temperature);
      const humidity = Number(body.humidity);

      if (
        !Number.isFinite(temperature) ||
        !Number.isFinite(humidity) ||
        temperature < -100 ||
        temperature > 150 ||
        humidity < 0 ||
        humidity > 100
      ) {
        return res.status(400).json({
          error: "Invalid sensor data"
        });
      }

      const mode =
        await redis.get(deviceKey(id, "mode")) || "CHILLER";

      const data = {
        device: id,
        temperature,
        humidity,
        mode,
        status: String(body.status || "NORMAL").slice(0, 40),
        alarm_reason: String(body.alarm_reason || "").slice(0, 100),
        alarm_active: Boolean(body.alarm_active),
        sensor_error: Boolean(body.sensor_error),
        uptime: Math.max(0, Number(body.uptime) || 0),
        last_seen: Date.now()
      };

      await redis.set(
        deviceKey(id, "data"),
        JSON.stringify(data)
      );

      await redis.set(
        deviceKey(id, "last_seen"),
        Date.now()
      );

      return res.status(200).json({
        success: true,
        message: "Data received"
      });
    }

    const raw = await redis.get(deviceKey(id, "data"));

    const data = raw
      ? typeof raw === "string" ? JSON.parse(raw) : raw
      : null;

    return res.status(200).json({
      success: true,
      device: id,
      data
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
