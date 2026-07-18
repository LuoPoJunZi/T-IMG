import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { onRequest } from "../functions/file/[id].js";

function basic(user, pass) {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

function fileContext({
  id = "1234567890abcdef12345678.png",
  method = "GET",
  headers = {},
  env = {},
} = {}) {
  return {
    request: new Request(`https://example.com/file/${id}`, { method, headers }),
    params: { id },
    env,
  };
}

describe("file proxy", function () {
  const originalFetch = globalThis.fetch;
  let originalConsoleWarn;

  beforeEach(function () {
    originalConsoleWarn = console.warn;
    console.warn = () => {};
  });

  afterEach(function () {
    globalThis.fetch = originalFetch;
    console.warn = originalConsoleWarn;
  });

  it("rejects unsupported methods and invalid identifiers", async function () {
    const methodResponse = await onRequest(fileContext({ method: "POST" }));
    const idResponse = await onRequest(fileContext({ id: "../private" }));
    assert.equal(methodResponse.status, 405);
    assert.equal(idResponse.status, 400);
  });

  it("forwards only safe request headers to Telegraph", async function () {
    let captured;
    globalThis.fetch = async (url, options) => {
      captured = { url: String(url), options };
      return new Response("image", { status: 200, headers: { "Content-Type": "image/png" } });
    };

    const response = await onRequest(fileContext({
      headers: {
        Accept: "image/*",
        Range: "bytes=0-10",
        Authorization: "Basic private-value",
        Cookie: "session=private",
      },
    }));

    assert.equal(response.status, 200);
    assert.match(captured.url, /^https:\/\/telegra\.ph\/file\//);
    assert.equal(captured.options.headers.get("Accept"), "image/*");
    assert.equal(captured.options.headers.get("Range"), "bytes=0-10");
    assert.equal(captured.options.headers.has("Authorization"), false);
    assert.equal(captured.options.headers.has("Cookie"), false);
  });

  it("does not call Telegram when its token is missing", async function () {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response("unexpected"); };
    const response = await onRequest(fileContext({
      id: "BQAC_abcdefghijklmnopqrstuvwxyz0123456789.txt",
    }));

    assert.equal(response.status, 503);
    assert.equal(calls, 0);
  });

  it("returns a stable error when Telegram lookup fails", async function () {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 400 });
    const response = await onRequest(fileContext({
      id: "BQAC_abcdefghijklmnopqrstuvwxyz0123456789.txt",
      env: { TG_Bot_Token: "private-test-token" },
    }));
    const body = await response.text();

    assert.equal(response.status, 502);
    assert.equal(body.includes("private-test-token"), false);
    assert.equal(JSON.parse(body).code, "telegram_file_unavailable");
  });

  it("does not trust an admin Referer without valid configured credentials", async function () {
    globalThis.fetch = async () => new Response("blocked image", { status: 200 });
    const env = {
      BASIC_USER: "admin",
      BASIC_PASS: "secret",
      img_url: {
        getWithMetadata: async () => ({ value: "", metadata: { ListType: "Block", Label: "None" } }),
      },
    };

    const spoofed = await onRequest(fileContext({
      headers: { Referer: "https://example.com/admin-gallery.html" },
      env,
    }));
    const authenticated = await onRequest(fileContext({
      headers: {
        Referer: "https://example.com/admin-gallery.html",
        Authorization: basic("admin", "secret"),
      },
      env,
    }));

    assert.equal(spoofed.status, 302);
    assert.equal(authenticated.status, 200);
  });

  it("keeps serving files when an optional metadata write fails", async function () {
    globalThis.fetch = async () => new Response("image", { status: 200 });
    const response = await onRequest(fileContext({
      env: {
        img_url: {
          getWithMetadata: async () => ({ value: null, metadata: null }),
          put: async () => { throw new Error("KV unavailable"); },
        },
      },
    }));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "image");
  });

  it("does not send Telegram file URLs to the moderation service", async function () {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      if (urls.length === 1) {
        return new Response(JSON.stringify({ ok: true, result: { file_path: "documents/file.txt" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("file", { status: 200 });
    };

    const response = await onRequest(fileContext({
      id: "BQAC_abcdefghijklmnopqrstuvwxyz0123456789.txt",
      env: {
        TG_Bot_Token: "private-test-token",
        ModerateContentApiKey: "private-test-key",
        img_url: {
          getWithMetadata: async () => ({ value: "", metadata: { ListType: "None", Label: "None" } }),
          put: async () => {},
        },
      },
    }));

    assert.equal(response.status, 200);
    assert.equal(urls.length, 2);
    assert.equal(urls.some((url) => url.includes("moderatecontent.com")), false);
  });
});
