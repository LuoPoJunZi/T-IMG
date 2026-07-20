import assert from "node:assert/strict";
import { describe, it } from "node:test";

const baseUrl = process.env.T_IMG_PAGES_BASE_URL || "";
const LOCAL_UPLOAD_PASSWORD = "local_development_upload_password";

function requestUrl(path) {
  return new URL(path, baseUrl).toString();
}

function sessionCookie(response) {
  const setCookie = response.headers.get("Set-Cookie") || "";
  assert.match(setCookie, /^__Host-t_img_upload_session=/);
  return setCookie.split(";", 1)[0];
}

describe("Pages HTTP upload flow", { skip: !baseUrl }, function () {
  it("protects pages and the upload endpoint through the actual Pages router", async function () {
    const pageResponse = await fetch(requestUrl("/"), { redirect: "manual" });
    assert.equal(pageResponse.status, 302);
    assert.match(pageResponse.headers.get("Location") || "", /\/upload-login\?returnTo=%2F$/);

    const loginPageResponse = await fetch(requestUrl("/upload-login"));
    assert.equal(loginPageResponse.status, 200);

    const invalidShortLink = await fetch(requestUrl("/i/not-a-short-link"));
    assert.equal(invalidShortLink.status, 400);
    assert.equal((await invalidShortLink.json()).code, "invalid_file_id");

    const unauthorizedForm = new FormData();
    unauthorizedForm.append("file", new File(["image"], "image.png", { type: "image/png" }));
    const unauthorizedUpload = await fetch(requestUrl("/upload"), {
      method: "POST",
      body: unauthorizedForm,
      headers: { Origin: baseUrl },
    });
    assert.equal(unauthorizedUpload.status, 401);
    assert.equal((await unauthorizedUpload.json()).code, "upload_auth_required");
  });

  it("creates, uses, and clears a signed upload session over HTTP", async function () {
    const loginResponse = await fetch(requestUrl("/api/upload-auth/login"), {
      method: "POST",
      body: new URLSearchParams({ password: LOCAL_UPLOAD_PASSWORD, returnTo: "/" }),
      headers: {
        Accept: "application/json",
        Origin: baseUrl,
      },
      redirect: "manual",
    });
    assert.equal(loginResponse.status, 200);
    const cookie = sessionCookie(loginResponse);

    const protectedPage = await fetch(requestUrl("/"), {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(protectedPage.status, 200);

    const uploadForm = new FormData();
    uploadForm.append("file", new File(["image"], "image.png", { type: "image/png" }));
    const configuredRouteResponse = await fetch(requestUrl("/upload"), {
      method: "POST",
      body: uploadForm,
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
      },
    });
    assert.equal(configuredRouteResponse.status, 503);
    assert.equal((await configuredRouteResponse.json()).code, "telegram_not_configured");

    const logoutResponse = await fetch(requestUrl("/api/upload-auth/logout"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
    });
    assert.equal(logoutResponse.status, 200);
    assert.match(logoutResponse.headers.get("Set-Cookie") || "", /Max-Age=0/);
  });
});
