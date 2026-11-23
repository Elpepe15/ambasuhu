
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { redis, deviceKey } from "./redis.js";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET
);

export async function verifyDevice(id, password) {
  if (!id || !password) return false;

  const hash = await redis.get(
    deviceKey(id, "password_hash")
  );

  if (!hash) return false;

  return bcrypt.compare(password, hash);
}

export async function createSession(id) {
  return new SignJWT({ deviceId: id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(req) {
  const cookie = req.headers.cookie || "";

  const token = cookie
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith("ambasuhu_session="))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);

    if (!payload.deviceId) return null;

    return payload.deviceId;
  } catch {
    return null;
  }
}

export async function verifyDeviceRequest(req) {
  const id = req.headers["x-device-id"];
  const password = req.headers["x-device-password"];

  if (!(await verifyDevice(id, password))) {
    return null;
  }

  return id;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `ambasuhu_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  );
}
