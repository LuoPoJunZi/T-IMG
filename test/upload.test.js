import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { onRequestPost } from "../functions/upload.js";

const uploadAccessEnv = {
  UPLOAD_ACCESS_PASSWORD: "test-upload-password",
  UPLOAD_SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
  BASIC_USER: "admin",
  BASIC_PASS: "management-secret",
};

function imageIndex(put = async () => {}) {
  return { put };
}

function configuredEnv(extra = {}) {
  return { ...uploadAccessEnv, img_url: imageIndex(), ...extra };
}

function uploadRequest(file, authenticated = true, extraHeaders = {}) {
  const formData = new FormData();
  if (file !== undefined) formData.append("file", file);
  const authHeaders = authenticated
    ? { Authorization: `Basic ${btoa("admin:management-secret")}` }
    : {};
  const headers = { ...authHeaders, ...extraHeaders };
  return new Request("https://example.com/upload", { method: "POST", body: formData, headers });
}

function telegramResponse(result, status = 200) {
  return new Response(JSON.stringify(result), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

describe("upload endpoint", function () {
  const originalFetch = globalThis.fetch;
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(function () {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(function () {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it("rejects direct uploads without a valid session or management login", async function () {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return telegramResponse({ ok: true });
    };

    const response = await onRequestPost({
      request: uploadRequest(new File(["data"], "image.png", { type: "image/png" }), false),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });

    assert.equal(response.status, 401);
    assert.equal((await responseJson(response)).code, "upload_auth_required");
    assert.equal(fetchCalled, false);
  });

  it("fails closed when upload access protection is not configured", async function () {
    const response = await onRequestPost({
      request: uploadRequest(new File(["data"], "image.png", { type: "image/png" })),
      env: { TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" },
    });

    assert.equal(response.status, 503);
    assert.equal((await responseJson(response)).code, "upload_auth_not_configured");
  });

  it("rejects cross-site uploads even with otherwise valid credentials", async function () {
    const response = await onRequestPost({
      request: uploadRequest(
        new File(["data"], "image.png", { type: "image/png" }),
        true,
        { Origin: "https://evil.example" },
      ),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });

    assert.equal(response.status, 403);
    assert.equal((await responseJson(response)).code, "cross_site_request");
  });

  it("rejects uploads when Telegram is not configured", async function () {
    let fetchCalled = false;
    const logMessages = [];
    console.error = (...values) => logMessages.push(values.join(" "));
    globalThis.fetch = async () => {
      fetchCalled = true;
      return telegramResponse({ ok: true });
    };

    const response = await onRequestPost({
      request: uploadRequest(new File(["data"], "image.png", { type: "image/png" })),
      env: configuredEnv(),
    });

    assert.equal(response.status, 503);
    assert.equal((await responseJson(response)).code, "telegram_not_configured");
    assert.equal(fetchCalled, false);
    assert.match(logMessages.join("\n"), /TG_Bot_Token, TG_Chat_ID/);
  });

  it("rejects uploads before Telegram when the required img_url binding is missing or invalid", async function () {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return telegramResponse({ ok: true });
    };

    for (const imgUrl of [undefined, "not-a-kv-binding", {}]) {
      const response = await onRequestPost({
        request: uploadRequest(new File(["data"], "image.png", { type: "image/png" })),
        env: configuredEnv({
          TG_Bot_Token: "test-token",
          TG_Chat_ID: "test-chat",
          img_url: imgUrl,
        }),
      });

      assert.equal(response.status, 503);
      assert.equal((await responseJson(response)).code, "image_index_not_configured");
    }
    assert.equal(fetchCalled, false);
  });

  it("rejects an empty file", async function () {
    const response = await onRequestPost({
      request: uploadRequest(new File([], "empty.png", { type: "image/png" })),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });

    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).code, "file_empty");
  });

  it("enforces the configured upload limit", async function () {
    const response = await onRequestPost({
      request: uploadRequest(new File(["1234"], "small.bin")),
      env: configuredEnv({
        TG_Bot_Token: "test-token",
        TG_Chat_ID: "test-chat",
        MAX_UPLOAD_SIZE_BYTES: "3",
      }),
    });

    assert.equal(response.status, 413);
    assert.equal((await responseJson(response)).code, "file_too_large");
  });

  it("returns the compatible success payload and stores safe metadata", async function () {
    let stored;
    globalThis.fetch = async () => telegramResponse({
      ok: true,
      result: { document: { file_id: "BQAC_safe-file-id" } },
    });

    const response = await onRequestPost({
      request: uploadRequest(new File(["hello"], "unsafe\u0000name.invalid!", { type: "text/plain" })),
      env: configuredEnv({
        TG_Bot_Token: "test-token",
        TG_Chat_ID: "test-chat",
        img_url: imageIndex(async (key, value, options) => {
          stored = { key, value, options };
        }),
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await responseJson(response), [{ src: "/file/BQAC_safe-file-id.txt" }]);
    assert.equal(stored.key, "BQAC_safe-file-id.txt");
    assert.equal(stored.options.metadata.fileName, "unsafename.invalid!");
    assert.equal(stored.options.metadata.fileSize, 5);
  });

  it("does not report a false failure when the required KV write fails after Telegram succeeds", async function () {
    globalThis.fetch = async () => telegramResponse({
      ok: true,
      result: { document: { file_id: "BQAC_kv-failure" } },
    });

    const response = await onRequestPost({
      request: uploadRequest(new File(["hello"], "file.txt", { type: "text/plain" })),
      env: configuredEnv({
        TG_Bot_Token: "test-token",
        TG_Chat_ID: "test-chat",
        img_url: imageIndex(async () => { throw new Error("KV unavailable"); }),
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await responseJson(response), [{ src: "/file/BQAC_kv-failure.txt" }]);
  });

  it("does not expose Telegram error descriptions", async function () {
    globalThis.fetch = async () => telegramResponse({
      ok: false,
      description: "private Telegram details",
    }, 400);

    const response = await onRequestPost({
      request: uploadRequest(new File(["hello"], "file.txt", { type: "text/plain" })),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });
    const body = await response.text();

    assert.equal(response.status, 502);
    assert.equal(body.includes("private Telegram details"), false);
    assert.equal(JSON.parse(body).code, "telegram_upload_failed");
  });

  it("falls back from photo to document without changing the public response", async function () {
    const fields = [];
    globalThis.fetch = async (url, options) => {
      fields.push(options.body.has("photo") ? "photo" : "document");
      if (fields.length === 1) return telegramResponse({ ok: false }, 400);
      return telegramResponse({ ok: true, result: { document: { file_id: "BQAC_photo-fallback" } } });
    };

    const response = await onRequestPost({
      request: uploadRequest(new File(["image"], "image.png", { type: "image/png" })),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(fields, ["photo", "document"]);
  });

  it("returns a stable error after network retries", async function () {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      throw new Error("network details");
    };

    const response = await onRequestPost({
      request: uploadRequest(new File(["hello"], "file.txt", { type: "text/plain" })),
      env: configuredEnv({ TG_Bot_Token: "test-token", TG_Chat_ID: "test-chat" }),
    });
    const body = await responseJson(response);

    assert.equal(attempts, 3);
    assert.equal(response.status, 502);
    assert.equal(body.code, "telegram_network_error");
  });
});
