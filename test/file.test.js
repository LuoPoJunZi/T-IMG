import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { onRequest } from "../functions/file/[id].js";

function basic(user, pass) {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

function fileContext({
  id = "1234567890abcdef12345678.png",
  route = "file",
  method = "GET",
  headers = {},
  env = {},
} = {}) {
  return {
    request: new Request(`https://example.com/${route}/${id}`, { method, headers }),
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

  it("keeps public file access available when img_url is bound with the wrong type", async function () {
    globalThis.fetch = async () => new Response("image", {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });

    const response = await onRequest(fileContext({ env: { img_url: "not-a-kv-binding" } }));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "image");
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
        put: async () => {},
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

  it("keeps serving public files when a metadata write fails at runtime", async function () {
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

  it("resolves a short link with one KV read and no metadata rewrite", async function () {
    const urls = [];
    let fileId;
    let reads = 0;
    let writes = 0;
    globalThis.fetch = async (url, options) => {
      urls.push(String(url));
      if (urls.length === 1) {
        fileId = options.body.get("file_id");
        return new Response(JSON.stringify({ ok: true, result: { file_path: "photos/short.png" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("short image", { status: 200 });
    };

    const response = await onRequest(fileContext({
      route: "i",
      id: "AbCdEf0123_-.png",
      env: {
        TG_Bot_Token: "private-test-token",
        img_url: {
          getWithMetadata: async () => {
            reads += 1;
            return {
              value: "",
              metadata: {
                telegramFileId: "BQAC_short-link-file-id",
                ListType: "None",
                Label: "None",
                TimeStamp: 1,
              },
            };
          },
          put: async () => { writes += 1; },
        },
      },
    }));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "short image");
    assert.equal(fileId, "BQAC_short-link-file-id");
    assert.equal(reads, 1);
    assert.equal(writes, 0);
    assert.equal(urls.length, 2);
  });

  it("keeps the management /file path compatible with short-code records", async function () {
    let telegramLookup = false;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/getFile")) {
        telegramLookup = true;
        return new Response(JSON.stringify({ ok: true, result: { file_path: "documents/file.txt" } }));
      }
      return new Response("file", { status: 200 });
    };

    const response = await onRequest(fileContext({
      id: "AbCdEf0123_-.txt",
      env: {
        TG_Bot_Token: "private-test-token",
        img_url: {
          getWithMetadata: async () => ({
            value: "",
            metadata: { telegramFileId: "BQAC_short-link-file-id", ListType: "None", Label: "None" },
          }),
          put: async () => {},
        },
      },
    }));

    assert.equal(response.status, 200);
    assert.equal(telegramLookup, true);
  });

  it("fails safely when a short link is missing or the image index is unavailable", async function () {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response("unexpected");
    };

    const missing = await onRequest(fileContext({
      route: "i",
      id: "AbCdEf0123_-.png",
      env: {
        img_url: {
          getWithMetadata: async () => ({ value: null, metadata: null }),
          put: async () => {},
        },
      },
    }));
    const unavailable = await onRequest(fileContext({
      route: "i",
      id: "AbCdEf0123_-.png",
    }));

    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "short_link_not_found");
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, "image_index_unavailable");
    assert.equal(fetchCalled, false);
  });
});
