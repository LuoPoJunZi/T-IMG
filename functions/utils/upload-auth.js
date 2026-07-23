import { getBasicAuthState, validateBasicCredentials } from "./auth.js";

export const UPLOAD_SESSION_COOKIE = "__Host-t_img_upload_session";

const SESSION_VERSION = "v1";
const DEFAULT_SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const MIN_SESSION_MAX_AGE = 5 * 60;
const MAX_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const MIN_PASSWORD_LENGTH = 12;
const MIN_SESSION_SECRET_LENGTH = 32;
const MAX_SESSION_TOKEN_LENGTH = 512;
const textEncoder = new TextEncoder();

const PROTECTED_UPLOAD_PATHS = new Set([
  "/",
  "/index",
  "/index.html",
  "/markdown-upload",
  "/markdown-upload.html",
]);

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmac(key, value) {
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return new Uint8Array(signature);
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function parseSessionMaxAge(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SESSION_MAX_AGE;
  }
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (parsed < MIN_SESSION_MAX_AGE || parsed > MAX_SESSION_MAX_AGE) return null;
  return parsed;
}

export function getUploadAuthConfig(env = {}) {
  const password = typeof env.UPLOAD_ACCESS_PASSWORD === "string"
    ? env.UPLOAD_ACCESS_PASSWORD
    : "";
  const sessionSecret = typeof env.UPLOAD_SESSION_SECRET === "string"
    ? env.UPLOAD_SESSION_SECRET
    : "";
  const sessionMaxAge = parseSessionMaxAge(env.UPLOAD_SESSION_MAX_AGE);

  if (
    password.length < MIN_PASSWORD_LENGTH
    || sessionSecret.length < MIN_SESSION_SECRET_LENGTH
    || sessionMaxAge === null
  ) {
    return { state: "misconfigured" };
  }

  return {
    state: "ready",
    password,
    sessionSecret,
    sessionMaxAge,
  };
}

export function isProtectedUploadPath(pathname) {
  return PROTECTED_UPLOAD_PATHS.has(pathname);
}

export function sanitizeUploadReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, "https://t-img.invalid");
    if (url.origin !== "https://t-img.invalid" || !isProtectedUploadPath(url.pathname)) {
      return "/";
    }
    return url.pathname;
  } catch {
    return "/";
  }
}

export function isSameOriginRequest(request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) return false;
  return request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

export async function verifyUploadPassword(candidate, config) {
  if (config?.state !== "ready" || typeof candidate !== "string") return false;
  const key = await importHmacKey(config.sessionSecret);
  const expectedSignature = await hmac(key, `upload-password\0${config.password}`);
  return crypto.subtle.verify(
    "HMAC",
    key,
    expectedSignature,
    textEncoder.encode(`upload-password\0${candidate}`),
  );
}

export async function createUploadSessionToken(config, issuedAt = nowInSeconds()) {
  if (config?.state !== "ready") throw new Error("Upload authentication is not configured");
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = base64UrlEncode(nonceBytes);
  const expiresAt = issuedAt + config.sessionMaxAge;
  const payload = `${SESSION_VERSION}.${issuedAt}.${expiresAt}.${nonce}`;
  const key = await importHmacKey(config.sessionSecret);
  const signature = base64UrlEncode(await hmac(key, payload));
  return `${payload}.${signature}`;
}

export function createUploadSessionCookie(token, maxAge, issuedAt = nowInSeconds()) {
  const expires = new Date((issuedAt + maxAge) * 1000).toUTCString();
  return `${UPLOAD_SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; Expires=${expires}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearUploadSessionCookie() {
  return `${UPLOAD_SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;
}

export async function getUploadSessionState(request, env, currentTime = nowInSeconds()) {
  const config = getUploadAuthConfig(env);
  if (config.state !== "ready") return { state: "configuration_error" };

  const token = getCookie(request, UPLOAD_SESSION_COOKIE);
  if (!token) return { state: "missing", config };
  if (token.length > MAX_SESSION_TOKEN_LENGTH) return { state: "invalid", config };

  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== SESSION_VERSION) {
    return { state: "invalid", config };
  }

  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const nonce = parts[3];
  const signature = base64UrlDecode(parts[4]);
  if (
    !Number.isSafeInteger(issuedAt)
    || !Number.isSafeInteger(expiresAt)
    || !/^[A-Za-z0-9_-]{22}$/.test(nonce)
    || !signature
    || issuedAt > currentTime + 60
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > config.sessionMaxAge
  ) {
    return { state: "invalid", config };
  }
  if (expiresAt <= currentTime) return { state: "expired", config };

  const payload = parts.slice(0, 4).join(".");
  const key = await importHmacKey(config.sessionSecret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    textEncoder.encode(payload),
  );
  return { state: valid ? "valid" : "invalid", config, expiresAt };
}

export async function getUploadRequestAuthorization(request, env) {
  const session = await getUploadSessionState(request, env);
  if (session.state === "configuration_error") return { state: "configuration_error" };
  if (session.state === "valid") return { state: "authorized", method: "session" };

  if (
    getBasicAuthState(env) === "enabled"
    && validateBasicCredentials(request, env) === "valid"
  ) {
    return { state: "authorized", method: "management_basic" };
  }

  return { state: "unauthorized" };
}
