import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { onRequest as editName } from "../functions/api/manage/edit-name/[id].js";
import { onRequest as legacyEditName } from "../functions/api/manage/editName/[id].js";
import { onRequest as toggleLike } from "../functions/api/manage/toggle-like/[id].js";
import { onRequest as legacyToggleLike } from "../functions/api/manage/toggleLike/[id].js";
import { onRequest as fileRoute } from "../functions/file/[id].js";
import { onRequest as shortLinkRoute } from "../functions/i/[id].js";

describe("repository naming conventions", function () {
  it("keeps canonical pages, assets, and localized documentation", function () {
    const canonicalPaths = [
      "README.zh-CN.md",
      "admin-gallery.html",
      "markdown-upload.html",
      "upload-login.html",
      "image-blocked.html",
      "whitelist-enabled.html",
      "assets/images/background.svg",
      "assets/icons/music.svg",
      "assets/styles/admin-gallery.css",
      "assets/styles/upload-login.css",
      "assets/scripts/upload-login.js",
      "assets/scripts/upload-feedback.js",
      "functions/i/[id].js",
      "functions/i/_middleware.js",
      "_routes.json",
    ];

    for (const path of canonicalPaths) assert.equal(existsSync(path), true, `${path} must exist`);
  });

  it("redirects every retired static path to its canonical replacement", function () {
    const redirects = readFileSync("_redirects", "utf8");
    const expectedRules = [
      "/index-md.html /markdown-upload.html 301",
      "/admin-imgtc.html /admin-gallery.html 301",
      "/admin-imgtc.css /assets/styles/admin-gallery.css 301",
      "/block-img.html /image-blocked.html 301",
      "/whitelist-on.html /whitelist-enabled.html 301",
      "/bg.svg /assets/images/background.svg 301",
      "/music.svg /assets/icons/music.svg 301",
    ];

    for (const rule of expectedRules) assert.equal(redirects.includes(rule), true, `${rule} must remain`);
  });

  it("routes every upload page alias through Pages Functions", function () {
    const routes = JSON.parse(readFileSync("_routes.json", "utf8"));
    const protectedPaths = ["/", "/index", "/index.html", "/markdown-upload", "/markdown-upload.html", "/upload-login", "/upload-login.html", "/upload"];
    for (const path of protectedPaths) {
      assert.equal(routes.include.includes(path), true, `${path} must invoke the authentication middleware`);
    }
  });

  it("routes short links through the shared file proxy", function () {
    const routes = JSON.parse(readFileSync("_routes.json", "utf8"));
    assert.equal(routes.include.includes("/i/*"), true);
    assert.equal(shortLinkRoute, fileRoute);
  });

  it("loads safe upload error feedback on every upload page", function () {
    const scriptTag = '<script src="/assets/scripts/upload-feedback.js"></script>';
    for (const page of ["index.html", "markdown-upload.html"]) {
      const html = readFileSync(page, "utf8");
      assert.equal(html.includes(scriptTag), true, `${page} must load upload feedback`);
    }
  });

  it("does not show an explicit logout control on upload pages", function () {
    for (const page of ["index.html", "markdown-upload.html"]) {
      const html = readFileSync(page, "utf8");
      assert.equal(html.includes("upload-session-logout"), false, `${page} must not include logout control styles`);
      assert.equal(html.includes('action="/api/upload-auth/logout"'), false, `${page} must not include a logout form`);
      assert.equal(html.includes("退出上传"), false, `${page} must not include the logout label`);
    }
  });

  it("keeps legacy camelCase management routes as compatible aliases", function () {
    assert.equal(legacyEditName, editName);
    assert.equal(legacyToggleLike, toggleLike);
  });
});
