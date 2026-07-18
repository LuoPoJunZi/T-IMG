function parseBasicAuthentication(request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;

  try {
    const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes).normalize();
    const separator = decoded.indexOf(":");
    if (separator < 0 || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
    return {
      user: decoded.slice(0, separator),
      pass: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function safeEqual(expected, actual) {
  const left = String(expected);
  const right = String(actual);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function getBasicAuthState(env) {
  const hasUser = typeof env.BASIC_USER === "string" && env.BASIC_USER.length > 0;
  const hasPass = typeof env.BASIC_PASS === "string" && env.BASIC_PASS.length > 0;
  if (hasUser !== hasPass) return "misconfigured";
  return hasUser ? "enabled" : "disabled";
}

export function validateBasicCredentials(request, env) {
  if (!request.headers.has("Authorization")) return "missing";
  const credentials = parseBasicAuthentication(request);
  if (!credentials) return "malformed";
  if (!safeEqual(env.BASIC_USER, credentials.user) || !safeEqual(env.BASIC_PASS, credentials.pass)) {
    return "invalid";
  }
  return "valid";
}
