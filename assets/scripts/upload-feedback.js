(() => {
  "use strict";

  const messagesByCode = {
    cross_site_request: "上传请求已被安全策略拒绝，请刷新页面后重试。",
    file_empty: "所选文件为空，请重新选择。",
    file_missing: "没有读取到上传文件，请重新选择。",
    file_too_large: "文件超过站点允许的上传大小。",
    image_index_not_configured: "上传服务配置未完成，请联系站点所有者。",
    invalid_form_data: "上传请求格式无效，请重新选择文件。",
    telegram_invalid_response: "上传服务返回异常，请稍后重试。",
    telegram_network_error: "上传服务网络异常，请稍后重试。",
    telegram_not_configured: "上传服务配置未完成，请联系站点所有者。",
    telegram_upload_failed: "上传服务拒绝了该文件，请检查文件后重试。",
    upload_auth_not_configured: "上传验证配置未完成，请联系站点所有者。",
  };

  function getMessage(status, code) {
    if (code && messagesByCode[code]) return messagesByCode[code];
    if (status === 413) return "文件超过站点允许的上传大小。";
    if (status === 502) return "上传服务暂时不可用，请稍后重试。";
    if (status === 503) return "上传服务配置异常，请联系站点所有者。";
    if (status === 0) return "网络连接异常，请检查网络后重试。";
    return "上传失败，请稍后重试。";
  }

  function readErrorCode(xhr) {
    try {
      if (xhr.responseType === "json" && xhr.response && typeof xhr.response.code === "string") {
        return xhr.response.code;
      }
      const body = JSON.parse(xhr.responseText || "{}");
      return typeof body.code === "string" ? body.code : "";
    } catch {
      return "";
    }
  }

  function isUploadRequest(method, value) {
    if (String(method).toUpperCase() !== "POST") return false;
    try {
      const url = new URL(String(value), window.location.href);
      return url.origin === window.location.origin && url.pathname === "/upload";
    } catch {
      return false;
    }
  }

  function showUploadError(status, code) {
    if (status === 401 && code === "upload_auth_required") {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.assign(`/upload-login?returnTo=${returnTo}`);
      return;
    }

    window.requestAnimationFrame(() => {
      const message = document.querySelector(".area.error .text-area span");
      if (message) message.textContent = getMessage(status, code);
    });
  }

  const requestState = new WeakMap();
  const originalOpen = window.XMLHttpRequest.prototype.open;
  const originalSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function uploadAwareOpen(method, url) {
    requestState.set(this, isUploadRequest(method, url));
    return originalOpen.apply(this, arguments);
  };

  window.XMLHttpRequest.prototype.send = function uploadAwareSend() {
    if (requestState.get(this)) {
      this.addEventListener("loadend", () => {
        if (this.status >= 400 || this.status === 0) {
          showUploadError(this.status, readErrorCode(this));
        }
      }, { once: true });
    }
    return originalSend.apply(this, arguments);
  };

  window.TImgUploadFeedback = Object.freeze({ getMessage });
})();
