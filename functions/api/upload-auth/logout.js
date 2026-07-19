import {
  clearUploadSessionCookie,
  isSameOriginRequest,
} from "../../utils/upload-auth.js";

export async function onRequestPost({ request }) {
  if (!isSameOriginRequest(request)) {
    return new Response(JSON.stringify({ error: "Request rejected", code: "cross_site_request" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const headers = {
    "Set-Cookie": clearUploadSessionCookie(),
    "Cache-Control": "no-store",
  };
  if (request.headers.get("Accept")?.includes("application/json")) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: "/upload-login?loggedOut=1" },
  });
}
