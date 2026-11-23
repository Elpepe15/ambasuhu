
import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac } from "node:crypto";

// =====================================================
// REDIS CONNECTION
// =====================================================

export const redis = Redis.fromEnv();

// =====================================================
// CONFIGURATION
// =====================================================

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET belum dikonfigurasi dengan benar");
}

const SESSION_COOKIE = "ambasuhu_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 hari

// =====================================================
// JSON RESPONSE
// =====================================================

export function sendJson(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.json(data);
}

// =====================================================
// REQUEST BODY
// =====================================================

export function getBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return {};
}

// =====================================================
// DEVICE ID VALIDATION
// =====================================================

export function validDeviceId(id) {
  return (
    typeof id === "string" &&
    /^[a-zA-Z0-9_-]{3,64}$/.test(id)
  );
}

// =====================================================
// VERIFY DEVICE PASSWORD
// =====================================================

export async function verifyDeviceCredentials(id, password) {
  if (!validDeviceId(id)) return false;

  if (typeof password !== "string" || !password) {
    return false;
  }

  const hash = await redis.get(
    `device:${id}:password_hash`
  );

  if (typeof hash !== "string" || !hash) {
    return false;
  }

  return bcrypt.compare(password, hash);
}

// =====================================================
// DEVICE AUTHENTICATION FROM ESP32
// =====================================================

export async function verifyDeviceRequest(req) {
  const id = req.headers["x-device-id"];
  const password = req.headers["x-device-password"];

  const valid = await verifyDeviceCredentials(
    id,
    password
  );

  return valid ? id : null;
}

// =====================================================
// SESSION TOKEN HASH
// =====================================================

function hashSession(token) {
  return createHmac("sha256", SESSION_SECRET)
    .update(token)
    .digest("hex");
}

// =====================================================
// READ COOKIE
// =====================================================

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator < 0) continue;

    const key = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

// =====================================================
// CREATE LOGIN SESSION
// =====================================================

export async function createSession(res, deviceId) {
  const token = randomBytes(32).toString("hex");

  const key = `session:${hashSession(token)}`;

  await redis.set(
    key,
    JSON.stringify({
      deviceId,
      createdAt: Date.now()
    }),
    {
      ex: SESSION_TTL
    }
  );

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`
  );
}

// =====================================================
// GET CURRENT SESSION
// =====================================================

export async function getSession(req) {
  const token = getCookie(req, SESSION_COOKIE);

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const key = `session:${hashSession(token)}`;

  const stored = await redis.get(key);

  if (!stored) return null;

  try {
    const session =
      typeof stored === "string"
        ? JSON.parse(stored)
        : stored;

    if (!validDeviceId(session.deviceId)) {
      return null;
    }

    return session;

  } catch {
    return null;
  }
}

// =====================================================
// DELETE SESSION
// =====================================================

export async function destroySession(req, res) {
  const token = getCookie(req, SESSION_COOKIE);

  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await redis.del(
      `session:${hashSession(token)}`
    );
  }

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

// =====================================================
// REQUIRE WEBSITE SESSION
// =====================================================

export async function requireSession(req) {
  const session = await getSession(req);

  if (!session) return null;

  return session.deviceId;
}

// =====================================================
// REQUIRE DEVICE AUTHENTICATION
// =====================================================

export async function requireDevice(req) {
  return await verifyDeviceRequest(req);
}

// =====================================================
// AUTHENTICATE SESSION OR DEVICE
// =====================================================

export async function requireSessionOrDevice(req) {
  const sessionDevice = await requireSession(req);

  if (sessionDevice) {
    return sessionDevice;
  }

  return await requireDevice(req);
}
