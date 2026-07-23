import {
  createUploadSessionCookie,
  createUploadSessionToken,
  getUploadAuthConfig,
  isSameOriginRequest,
  sanitizeUploadReturnPath,
  verifyUploadPassword,
} from "../../utils/upload-auth.js";

const MAX_LOGIN_BODY_BYTES = 8 * 1024;

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function redirectResponse(path, cookie) {
  const headers = {
    Location: path,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 303, headers });
}

async function readLoginInput(request) {
  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGIN_BODY_BYTES) {
    return { state: "too_large" };
  }

  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_LOGIN_BODY_BYTES) {
      return { state: "too_large" };
    }

    if (contentType.includes("application/json")) {
      const body = JSON.parse(rawBody);
      return {
        state: "parsed",
        password: typeof body?.password === "string" ? body.password : null,
        returnTo: sanitizeUploadReturnPath(body?.returnTo),
        wantsJson: true,
      };
    }

    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return { state: "invalid" };
    }
    const formData = new URLSearchParams(rawBody);
    const password = formData.get("password");
    return {
      state: "parsed",
      password: typeof password === "string" ? password : null,
      returnTo: sanitizeUploadReturnPath(formData.get("returnTo")),
      wantsJson: request.headers.get("Accept")?.includes("application/json") || false,
    };
  } catch {
    return { state: "invalid" };
  }
}

function loginError(input, body, status, headers = {}) {
  if (input?.wantsJson) return jsonResponse(body, status, headers);
  return new Response(body.error, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Request rejected", code: "cross_site_request" }, 403);
  }

  const config = getUploadAuthConfig(env);
  if (config.state !== "ready") {
    return jsonResponse({ error: "Upload access protection is not configured", code: "upload_auth_not_configured" }, 503);
  }

  const input = await readLoginInput(request);
  if (input.state === "too_large") {
    return jsonResponse({ error: "Login request is too large", code: "login_request_too_large" }, 413);
  }
  if (input.state !== "parsed" || input.password === null) {
    return jsonResponse({ error: "Invalid login request", code: "invalid_login_request" }, 400);
  }

  const passwordIsValid = await verifyUploadPassword(input.password, config);
  if (!passwordIsValid) {
    return loginError(input, { error: "Invalid credentials", code: "invalid_credentials" }, 401);
  }

  const token = await createUploadSessionToken(config);
  const cookie = createUploadSessionCookie(token, config.sessionMaxAge);
  if (!input.wantsJson) return redirectResponse(input.returnTo, cookie);
  return jsonResponse({ authenticated: true, redirectTo: input.returnTo }, 200, {
    "Set-Cookie": cookie,
  });
}
