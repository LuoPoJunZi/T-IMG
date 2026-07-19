import { getUploadSessionState } from "../../utils/upload-auth.js";

function response(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const session = await getUploadSessionState(request, env);
  if (session.state === "configuration_error") {
    return response({
      authenticated: false,
      error: "Upload access protection is not configured",
      code: "upload_auth_not_configured",
    }, 503);
  }
  if (session.state !== "valid") {
    return response({ authenticated: false, code: "upload_auth_required" }, 401);
  }
  return response({ authenticated: true }, 200);
}
