
import {
  sendJson,
  getBody,
  validDeviceId,
  verifyDeviceCredentials,
  createSession
} from "../_lib.js";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {

    const body = getBody(req);

    const deviceId = body.deviceId;
    const password = body.password;

    if (
      !validDeviceId(deviceId) ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 128
    ) {
      return sendJson(res, 400, {
        error: "ID atau password tidak valid"
      });
    }

    const valid = await verifyDeviceCredentials(
      deviceId,
      password
    );

    if (!valid) {
      return sendJson(res, 401, {
        error: "ID perangkat atau password salah"
      });
    }

    await createSession(res, deviceId);

    return sendJson(res, 200, {
      success: true,
      authenticated: true,
      deviceId
    });

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    return sendJson(res, 500, {
      error: "Terjadi kesalahan server"
    });

  }

}
