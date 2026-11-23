
import {
  verifyDevice,
  createSession,
  setSessionCookie
} from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { deviceId, password } = req.body || {};

    if (!(await verifyDevice(deviceId, password))) {
      return res.status(401).json({
        success: false,
        message: "ID atau password salah"
      });
    }

    const token = await createSession(deviceId);

    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      deviceId
    });
  } catch {
    return res.status(500).json({
      error: "Login gagal"
    });
  }
}
