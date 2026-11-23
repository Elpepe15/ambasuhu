
import { verifySession } from "../_lib/auth.js";

export default async function handler(req, res) {
  const deviceId = await verifySession(req);

  if (!deviceId) {
    return res.status(401).json({
      authenticated: false
    });
  }

  return res.status(200).json({
    authenticated: true,
    deviceId
  });
}
