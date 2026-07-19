(() => {
  const allowedPaths = new Set([
    "/",
    "/index",
    "/index.html",
    "/markdown-upload",
    "/markdown-upload.html",
  ]);
  const params = new URLSearchParams(window.location.search);
  const requestedPath = params.get("returnTo") || "/";
  const returnTo = allowedPaths.has(requestedPath) ? requestedPath : "/";
  const form = document.getElementById("login-form");
  const password = document.getElementById("password");
  const returnInput = document.getElementById("return-to");
  const button = document.getElementById("submit-button");
  const message = document.getElementById("message");
  returnInput.value = returnTo;

  if (params.get("loggedOut") === "1") message.textContent = "已退出上传访问会话。";

  fetch("/api/upload-auth/session", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then((response) => {
    if (response.ok) window.location.replace(returnTo);
  }).catch(() => {});

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    message.textContent = "正在验证…";
    try {
      const body = new URLSearchParams({
        password: password.value,
        returnTo: returnInput.value,
      });
      const response = await fetch(form.action, {
        method: "POST",
        body,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.authenticated) {
        const redirectTo = allowedPaths.has(result.redirectTo) ? result.redirectTo : returnTo;
        window.location.assign(redirectTo);
        return;
      }
      if (response.status === 429) {
        message.textContent = "尝试次数过多，请稍后再试。";
      } else if (response.status === 401) {
        message.textContent = "访问密码不正确。";
      } else if (response.status === 503) {
        message.textContent = "验证服务暂时不可用，请联系站点所有者。";
      } else {
        message.textContent = "无法完成验证，请检查输入后重试。";
      }
    } catch {
      message.textContent = "网络连接异常，请稍后重试。";
    } finally {
      password.value = "";
      button.disabled = false;
      password.focus();
    }
  });
})();
