
import {
  sendJson,
  requireSession
} from "../_lib.js";

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {

    const deviceId = await requireSession(req);

    if (!deviceId) {
      return sendJson(res, 200, {
        authenticated: false
      });
    }

    return sendJson(res, 200, {
      authenticated: true,
      deviceId
    });

  } catch (error) {

    console.error("SESSION ERROR:", error);

    return sendJson(res, 500, {
      error: "Session check failed"
    });

  }

}
