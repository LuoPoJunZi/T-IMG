import {
  clearUploadSessionCookie,
  getUploadSessionState,
  isProtectedUploadPath,
} from "./utils/upload-auth.js";

const UPLOAD_LOGIN_PATHS = new Set(["/upload-login", "/upload-login.html"]);
const UPLOAD_LOGIN_CSP = "default-src 'none'; connect-src 'self'; form-action 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

function noStoreHeaders(headers = {}) {
  return {
    "Cache-Control": "private, no-store",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...headers,
  };
}

function configurationErrorResponse() {
  return new Response("上传访问保护尚未正确配置。", {
    status: 503,
    headers: noStoreHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function loginRedirect(request, clearStaleCookie) {
  const url = new URL(request.url);
  const loginUrl = new URL("/upload-login", url.origin);
  loginUrl.searchParams.set("returnTo", url.pathname);
  const headers = new Headers(noStoreHeaders({ Location: loginUrl.toString() }));
  if (clearStaleCookie) headers.set("Set-Cookie", clearUploadSessionCookie());
  return new Response(null, { status: 302, headers });
}

async function serveUploadLoginPage(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(noStoreHeaders({
    "Content-Security-Policy": UPLOAD_LOGIN_CSP,
  }))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function protectUploadPage(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (UPLOAD_LOGIN_PATHS.has(url.pathname)) return serveUploadLoginPage(context);
  if (!isProtectedUploadPath(url.pathname)) return context.next();

  const session = await getUploadSessionState(request, env);
  if (session.state === "configuration_error") return configurationErrorResponse();
  if (session.state !== "valid") {
    return loginRedirect(request, session.state !== "missing");
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(noStoreHeaders())) headers.set(name, value);
  headers.append("Vary", "Cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  try {
    return await protectUploadPage(context);
  } catch {
    console.error("Upload page access check failed");
    return new Response("Internal server error", {
      status: 500,
      headers: noStoreHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
    });
  }
}
