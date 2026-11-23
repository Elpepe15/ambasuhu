
import {
  verifyDeviceRequest,
  verifySession
} from "../_lib/auth.js";

import {
  redis,
  deviceKey
} from "../_lib/redis.js";

const modes = {
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
    let id;

    if (req.method === "GET") {
      id = await verifyDeviceRequest(req);
    } else if (req.method === "POST") {
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
      const mode = req.body?.mode;

      if (!modes[mode]) {
        return res.status(400).json({
          error: "Invalid mode"
        });
      }

      await redis.set(deviceKey(id, "mode"), mode);
    }

    const mode =
      await redis.get(deviceKey(id, "mode")) || "CHILLER";

    const limits = modes[mode];

    return res.status(200).json({
      success: true,
      device: id,
      mode,
      mode_id: limits.id,
      temperature_min: limits.temperature_min,
      temperature_max: limits.temperature_max,
      humidity_min: limits.humidity_min,
      humidity_max: limits.humidity_max
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
