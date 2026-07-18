import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { onRequest as editName } from "../functions/api/manage/edit-name/[id].js";
import { onRequest as legacyEditName } from "../functions/api/manage/editName/[id].js";
import { onRequest as toggleLike } from "../functions/api/manage/toggle-like/[id].js";
import { onRequest as legacyToggleLike } from "../functions/api/manage/toggleLike/[id].js";

describe("repository naming conventions", function () {
  it("keeps canonical pages, assets, and localized documentation", function () {
    const canonicalPaths = [
      "README.zh-CN.md",
      "admin-gallery.html",
      "markdown-upload.html",
      "image-blocked.html",
      "whitelist-enabled.html",
      "assets/images/background.svg",
      "assets/icons/music.svg",
      "assets/styles/admin-gallery.css",
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

  it("keeps legacy camelCase management routes as compatible aliases", function () {
    assert.equal(legacyEditName, editName);
    assert.equal(legacyToggleLike, toggleLike);
  });
});
