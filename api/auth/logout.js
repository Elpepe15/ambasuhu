
import {
  sendJson,
  destroySession
} from "../_lib.js";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {

    await destroySession(req, res);

    return sendJson(res, 200, {
      success: true,
      message: "Logout berhasil"
    });

  } catch (error) {

    console.error("LOGOUT ERROR:", error);

    return sendJson(res, 500, {
      error: "Logout gagal"
    });

  }

}
