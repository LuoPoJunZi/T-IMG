import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

const errorText = { textContent: "" };
let assignedLocation = "";

class FakeXMLHttpRequest {
  constructor() {
    this.listeners = new Map();
    this.responseText = "";
    this.responseType = "";
    this.status = 0;
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  open() {}

  send() {
    this.listeners.get("loadend")?.call(this);
  }
}

globalThis.document = {
  querySelector: () => errorText,
};
globalThis.window = {
  XMLHttpRequest: FakeXMLHttpRequest,
  location: {
    href: "https://example.com/",
    origin: "https://example.com",
    pathname: "/",
    assign: (value) => { assignedLocation = value; },
  },
  requestAnimationFrame: (callback) => callback(),
};

await import("../assets/scripts/upload-feedback.js");

after(function () {
  delete globalThis.document;
  delete globalThis.window;
});

describe("upload page error feedback", function () {
  it("maps safe backend codes to actionable messages", function () {
    const feedback = window.TImgUploadFeedback;
    assert.equal(
      feedback.getMessage(503, "image_index_not_configured"),
      "上传服务配置未完成，请联系站点所有者。",
    );
    assert.equal(
      feedback.getMessage(413, "file_too_large"),
      "文件超过站点允许的上传大小。",
    );
    assert.equal(feedback.getMessage(502, "unknown"), "上传服务暂时不可用，请稍后重试。");
  });

  it("observes upload failures without exposing the server response body", function () {
    const xhr = new window.XMLHttpRequest();
    xhr.open("POST", "/upload");
    xhr.status = 503;
    xhr.responseText = JSON.stringify({
      code: "telegram_not_configured",
      error: "private upstream detail",
    });
    xhr.send();

    assert.equal(errorText.textContent, "上传服务配置未完成，请联系站点所有者。");
    assert.equal(errorText.textContent.includes("private upstream detail"), false);
  });

  it("returns to login when an upload session has expired", function () {
    const xhr = new window.XMLHttpRequest();
    xhr.open("POST", "/upload");
    xhr.status = 401;
    xhr.responseText = JSON.stringify({ code: "upload_auth_required" });
    xhr.send();

    assert.equal(assignedLocation, "/upload-login?returnTo=%2F");
  });
});
