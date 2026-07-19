import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onRequest as middleware } from "../functions/api/manage/_middleware.js";
import { onRequest as editName } from "../functions/api/manage/edit-name/[id].js";
import { onRequest as block } from "../functions/api/manage/block/[id].js";
import { onRequest as toggleLike } from "../functions/api/manage/toggle-like/[id].js";
import { errorHandling as globalErrorHandling } from "../functions/utils/middleware.js";

function request(headers = {}) {
  return new Request("https://example.com/api/manage/list", { headers });
}

function basic(user, pass) {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

function managementBinding() {
  return {
    getWithMetadata: async () => ({ value: null, metadata: null }),
    put: async () => {},
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true }),
  };
}

describe("management middleware", function () {
  const [errorHandling, authentication] = middleware;

  it("disables management when KV is not bound", async function () {
    const response = await authentication({ request: request(), env: {}, next: () => new Response("ok") });
    assert.equal(response.status, 503);
  });

  it("rejects a text value or incomplete object in place of the img_url KV binding", async function () {
    for (const imgUrl of ["not-a-kv-binding", {}]) {
      const response = await authentication({
        request: request(),
        env: { img_url: imgUrl },
        next: () => new Response("ok"),
      });
      assert.equal(response.status, 503);
    }
  });

  it("rejects incomplete authentication configuration", async function () {
    const response = await authentication({
      request: request(),
      env: { img_url: managementBinding(), BASIC_USER: "admin" },
      next: () => new Response("ok"),
    });
    assert.equal(response.status, 503);
  });

  it("returns a Basic challenge when credentials are missing", async function () {
    const response = await authentication({
      request: request(),
      env: { img_url: managementBinding(), BASIC_USER: "admin", BASIC_PASS: "secret" },
      next: () => new Response("ok"),
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("WWW-Authenticate"), /T-IMG management/);
  });

  it("rejects malformed and invalid credentials without throwing", async function () {
    const env = { img_url: managementBinding(), BASIC_USER: "admin", BASIC_PASS: "secret" };
    const malformed = await authentication({
      request: request({ Authorization: "Basic !!!" }), env, next: () => new Response("ok"),
    });
    const invalid = await authentication({
      request: request({ Authorization: basic("admin", "wrong") }), env, next: () => new Response("ok"),
    });

    assert.equal(malformed.status, 400);
    assert.equal(invalid.status, 401);
  });

  it("allows valid credentials", async function () {
    let calls = 0;
    const response = await authentication({
      request: request({ Authorization: basic("admin", "secret") }),
      env: { img_url: managementBinding(), BASIC_USER: "admin", BASIC_PASS: "secret" },
      next: () => { calls += 1; return new Response("ok"); },
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  });

  it("does not return stack traces from management errors", async function () {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const response = await errorHandling({ next: () => { throw new Error("private stack marker"); } });
      const body = await response.text();
      assert.equal(response.status, 500);
      assert.equal(body.includes("private stack marker"), false);
      assert.equal(body.includes("at "), false);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("global error middleware", function () {
  it("returns a generic JSON error without leaking exception details", async function () {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const response = await globalErrorHandling({
        next: () => { throw new Error("private global stack marker"); },
      });
      const body = await response.text();
      assert.equal(response.status, 500);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(body.includes("private global stack marker"), false);
      assert.equal(JSON.parse(body).code, "internal_error");
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("management operations", function () {
  function mockKv(metadata) {
    const writes = [];
    return {
      writes,
      getWithMetadata: async () => ({ value: "", metadata }),
      put: async (key, value, options) => { writes.push({ key, value, options }); },
    };
  }

  it("uses the newName query parameter when renaming", async function () {
    const kv = mockKv({ fileName: "old.png", liked: false });
    const response = await editName({
      request: new Request("https://example.com/api/manage/edit-name/key?newName=renamed.png"),
      params: { id: "key" },
      env: { img_url: kv },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(await response.text()), { success: true, fileName: "renamed.png" });
    assert.equal(kv.writes[0].options.metadata.fileName, "renamed.png");
  });

  it("rejects invalid names before writing", async function () {
    const kv = mockKv({ fileName: "old.png" });
    const response = await editName({
      request: new Request("https://example.com/api/manage/edit-name/key?newName="),
      params: { id: "key" },
      env: { img_url: kv },
    });

    assert.equal(response.status, 400);
    assert.equal(kv.writes.length, 0);
  });

  it("returns 404 when metadata does not exist", async function () {
    const env = { img_url: { getWithMetadata: async () => ({ value: null, metadata: null }) } };
    const response = await block({ env, params: { id: "missing" } });
    assert.equal(response.status, 404);
  });

  it("updates block and liked state without mutating the source object", async function () {
    const original = { ListType: "None", liked: false };
    const kv = mockKv(original);
    const blockResponse = await block({ env: { img_url: kv }, params: { id: "key" } });
    const likeResponse = await toggleLike({ env: { img_url: kv }, params: { id: "key" } });

    assert.equal(blockResponse.status, 200);
    assert.equal(likeResponse.status, 200);
    assert.deepEqual(original, { ListType: "None", liked: false });
    assert.equal(kv.writes[0].options.metadata.ListType, "Block");
    assert.equal(kv.writes[1].options.metadata.liked, true);
  });
});
