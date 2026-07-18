import { getBasicAuthState, validateBasicCredentials } from "../../utils/auth.js";

function textResponse(message, status, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function unauthorized(message) {
  return textResponse(message, 401, {
    "WWW-Authenticate": 'Basic realm="T-IMG management", charset="UTF-8"',
  });
}

async function errorHandling(context) {
  try {
    return await context.next();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Management request failed:", errorName);
    return textResponse("Internal server error", 500);
  }
}

function authentication(context) {
  const { env, request } = context;
  if (!env.img_url) {
    return textResponse("Dashboard is disabled. Bind the img_url KV namespace to enable it.", 503);
  }

  const authState = getBasicAuthState(env);
  if (authState === "misconfigured") {
    return textResponse("Management authentication is not configured correctly.", 503);
  }
  if (authState === "disabled") {
    return context.next();
  }

  const credentialState = validateBasicCredentials(request, env);
  if (credentialState === "missing") {
    return unauthorized("Authentication required.");
  }
  if (credentialState === "malformed") {
    return textResponse("Malformed authorization header.", 400);
  }
  if (credentialState === "invalid") {
    return unauthorized("Invalid credentials.");
  }
  return context.next();
}

export const onRequest = [errorHandling, authentication];
