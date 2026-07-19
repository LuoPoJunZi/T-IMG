import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onRequest as pageMiddleware } from "../functions/_middleware.js";
import { onRequestPost as login } from "../functions/api/upload-auth/login.js";
import { onRequestPost as logout } from "../functions/api/upload-auth/logout.js";
import { onRequestGet as session } from "../functions/api/upload-auth/session.js";
import {
  UPLOAD_SESSION_COOKIE,
  createUploadSessionCookie,
  createUploadSessionToken,
  getUploadAuthConfig,
  getUploadSessionState,
  sanitizeUploadReturnPath,
} from "../functions/utils/upload-auth.js";

const baseEnv = {
  UPLOAD_ACCESS_PASSWORD: "test-upload-password",
  UPLOAD_SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
  UPLOAD_SESSION_MAX_AGE: "604800",
};

function createRateLimitKv() {
  const records = new Map();
  return {
    records,
    async get(key, type) {
      const value = records.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      records.set(key, value);
    },
    async delete(key) {
      records.delete(key);
    },
  };
}

function jsonRequest(password, returnTo = "/", extraHeaders = {}) {
  return new Request("https://example.com/api/upload-auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "CF-Connecting-IP": "203.0.113.10",
      ...extraHeaders,
    },
    body: JSON.stringify({ password, returnTo }),
  });
}

function cookiePair(setCookie) {
  return setCookie.split(";", 1)[0];
}

describe("upload access configuration and sessions", function () {
  it("fails configuration validation for missing, weak, or invalid values", function () {
    assert.equal(getUploadAuthConfig({}).state, "misconfigured");
    assert.equal(getUploadAuthConfig({
      UPLOAD_ACCESS_PASSWORD: "short",
      UPLOAD_SESSION_SECRET: baseEnv.UPLOAD_SESSION_SECRET,
    }).state, "misconfigured");
    assert.equal(getUploadAuthConfig({
      ...baseEnv,
      UPLOAD_SESSION_MAX_AGE: "60",
    }).state, "misconfigured");
    assert.equal(getUploadAuthConfig(baseEnv).state, "ready");
  });

  it("accepts a signed session and rejects tampering or expiration", async function () {
    const config = getUploadAuthConfig(baseEnv);
    const token = await createUploadSessionToken(config, 1_000);
    const validRequest = new Request("https://example.com/", {
      headers: { Cookie: `${UPLOAD_SESSION_COOKIE}=${token}` },
    });
    const tokenParts = token.split(".");
    tokenParts[4] = `${tokenParts[4][0] === "A" ? "B" : "A"}${tokenParts[4].slice(1)}`;
    const tamperedRequest = new Request("https://example.com/", {
      headers: { Cookie: `${UPLOAD_SESSION_COOKIE}=${tokenParts.join(".")}` },
    });

    assert.equal((await getUploadSessionState(validRequest, baseEnv, 1_100)).state, "valid");
    assert.equal((await getUploadSessionState(tamperedRequest, baseEnv, 1_100)).state, "invalid");
    assert.equal((await getUploadSessionState(validRequest, baseEnv, 1_000 + 604_800)).state, "expired");
  });

  it("creates a host-only secure cookie and restricts return paths", async function () {
    const config = getUploadAuthConfig(baseEnv);
    const token = await createUploadSessionToken(config, 1_000);
    const cookie = createUploadSessionCookie(token, config.sessionMaxAge, 1_000);

    assert.match(cookie, /^__Host-t_img_upload_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\//);
    assert.equal(cookie.includes("Domain="), false);
    assert.equal(sanitizeUploadReturnPath("/markdown-upload.html"), "/markdown-upload.html");
    assert.equal(sanitizeUploadReturnPath("//evil.example/path"), "/");
    assert.equal(sanitizeUploadReturnPath("/admin.html"), "/");
  });
});

describe("upload page middleware", function () {
  it("redirects an unauthenticated upload page request to the login page", async function () {
    let nextCalled = false;
    const response = await pageMiddleware({
      request: new Request("https://example.com/markdown-upload.html"),
      env: baseEnv,
      next: () => { nextCalled = true; return new Response("page"); },
    });

    assert.equal(response.status, 302);
    assert.equal(nextCalled, false);
    assert.equal(
      response.headers.get("Location"),
      "https://example.com/upload-login?returnTo=%2Fmarkdown-upload.html",
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("protects the extensionless upload paths used by Pages Clean URLs", async function () {
    for (const path of ["/", "/index", "/index.html", "/markdown-upload", "/markdown-upload.html"]) {
      const response = await pageMiddleware({
        request: new Request(`https://example.com${path}`),
        env: baseEnv,
        next: () => new Response("must not be served"),
      });
      assert.equal(response.status, 302, `${path} must require login`);
    }
  });

  it("serves protected HTML only with a valid session and disables caching", async function () {
    const config = getUploadAuthConfig(baseEnv);
    const token = await createUploadSessionToken(config);
    const response = await pageMiddleware({
      request: new Request("https://example.com/", {
        headers: { Cookie: `${UPLOAD_SESSION_COOKIE}=${token}` },
      }),
      env: baseEnv,
      next: () => new Response("upload page", { headers: { "Content-Type": "text/html" } }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "upload page");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(response.headers.get("Vary"), /Cookie/);
  });

  it("does not protect public files or management paths", async function () {
    for (const path of ["/file/public-id.png", "/admin.html", "/api/manage/list"]) {
      let nextCalled = false;
      const response = await pageMiddleware({
        request: new Request(`https://example.com${path}`),
        env: {},
        next: () => { nextCalled = true; return new Response("ok"); },
      });
      assert.equal(response.status, 200);
      assert.equal(nextCalled, true);
    }
  });

  it("serves the public login page through Functions with strict security headers", async function () {
    for (const path of ["/upload-login", "/upload-login.html"]) {
      const response = await pageMiddleware({
        request: new Request(`https://example.com${path}`),
        env: {},
        next: () => new Response("login page", { headers: { "Content-Type": "text/html" } }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.match(response.headers.get("Content-Security-Policy"), /script-src 'self'/);
      assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
      assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    }
  });

  it("fails closed when upload access secrets are unavailable", async function () {
    const response = await pageMiddleware({
      request: new Request("https://example.com/"),
      env: {},
      next: () => new Response("must not be served"),
    });
    assert.equal(response.status, 503);
  });
});

describe("upload authentication endpoints", function () {
  it("logs in with the correct password and recognizes the resulting session", async function () {
    const env = { ...baseEnv, UPLOAD_AUTH_KV: createRateLimitKv() };
    const loginResponse = await login({
      request: jsonRequest(baseEnv.UPLOAD_ACCESS_PASSWORD, "/markdown-upload.html"),
      env,
    });
    const result = JSON.parse(await loginResponse.text());
    const setCookie = loginResponse.headers.get("Set-Cookie");

    assert.equal(loginResponse.status, 200);
    assert.deepEqual(result, { authenticated: true, redirectTo: "/markdown-upload.html" });
    assert.ok(setCookie);

    const sessionResponse = await session({
      request: new Request("https://example.com/api/upload-auth/session", {
        headers: { Cookie: cookiePair(setCookie) },
      }),
      env,
    });
    assert.equal(sessionResponse.status, 200);
    assert.deepEqual(JSON.parse(await sessionResponse.text()), { authenticated: true });
  });

  it("supports the non-JavaScript form fallback without allowing an open redirect", async function () {
    const env = { ...baseEnv, UPLOAD_AUTH_KV: createRateLimitKv() };
    const body = new URLSearchParams({
      password: baseEnv.UPLOAD_ACCESS_PASSWORD,
      returnTo: "//evil.example/path",
    });
    const response = await login({
      request: new Request("https://example.com/api/upload-auth/login", {
        method: "POST",
        body,
      }),
      env,
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/");
    assert.ok(response.headers.get("Set-Cookie"));
  });

  it("rejects a wrong password and rate limits the fifth failure", async function () {
    const env = { ...baseEnv, UPLOAD_AUTH_KV: createRateLimitKv() };
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login({ request: jsonRequest("wrong-password"), env });
      assert.equal(response.status, attempt < 5 ? 401 : 429);
      const result = JSON.parse(await response.text());
      assert.equal(result.code, attempt < 5 ? "invalid_credentials" : "login_rate_limited");
      assert.equal(response.headers.has("Set-Cookie"), false);
    }
  });

  it("fails closed when the dedicated rate-limit KV binding is missing", async function () {
    const response = await login({
      request: jsonRequest(baseEnv.UPLOAD_ACCESS_PASSWORD),
      env: baseEnv,
    });
    assert.equal(response.status, 503);
    assert.equal(JSON.parse(await response.text()).code, "login_rate_limit_unavailable");
  });

  it("rejects cross-site login attempts", async function () {
    const response = await login({
      request: jsonRequest(baseEnv.UPLOAD_ACCESS_PASSWORD, "/", { Origin: "https://evil.example" }),
      env: { ...baseEnv, UPLOAD_AUTH_KV: createRateLimitKv() },
    });
    assert.equal(response.status, 403);
  });

  it("clears the session cookie on logout", async function () {
    const response = await logout({
      request: new Request("https://example.com/api/upload-auth/logout", {
        method: "POST",
        headers: { Accept: "application/json", Origin: "https://example.com" },
      }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
    assert.deepEqual(JSON.parse(await response.text()), { authenticated: false });
  });
});
