import { redis, requireSession, sendJson } from "../_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const deviceId = await requireSession(req);
    if (!deviceId) return sendJson(res, 401, { error: "Login required" });

    const requestedHours = Number(req.query?.hours || 24);
    const hours = Number.isFinite(requestedHours)
      ? Math.min(168, Math.max(1, requestedHours))
      : 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const key = `device:${deviceId}:history`;
    // Ambil hanya rentang yang diminta, bukan seluruh isi logger.
    const raw = await redis.zrange(key, cutoff, "+inf", { byScore: true });
    const points = [];

    for (const item of raw || []) {
      try {
        const point = typeof item === "string" ? JSON.parse(item) : item;
        if (
          Number.isFinite(Number(point.timestamp)) &&
          Number.isFinite(Number(point.temperature)) &&
          Number.isFinite(Number(point.humidity))
        ) points.push(point);
      } catch { /* Abaikan record yang rusak */ }
    }

    // Batasi ukuran respons; ambil sampel merata jika data lebih dari 500 titik.
    const limit = 500;
    let result = points;
    if (points.length > limit) {
      result = [];
      const step = (points.length - 1) / (limit - 1);
      for (let i = 0; i < limit; i++) {
        result.push(points[Math.round(i * step)]);
      }
    }

    return sendJson(res, 200, {
      success: true,
      points: result,
      retention_days: 7,
      interval_seconds: 30,
      range_hours: hours
    });
  } catch (error) {
    console.error("HISTORY ERROR:", error);
    return sendJson(res, 500, { error: "Server error" });
  }
}
