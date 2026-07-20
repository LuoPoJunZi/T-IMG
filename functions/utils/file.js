import { getBasicAuthState, validateBasicCredentials } from "./auth.js";

const FORWARDED_REQUEST_HEADERS = [
  "Accept",
  "Range",
  "If-Match",
  "If-None-Match",
  "If-Modified-Since",
  "If-Unmodified-Since",
  "If-Range",
];

function jsonError(status, code, message) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getSafeProxyHeaders(request) {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function hasFileMetadataBinding(binding) {
  return binding
    && typeof binding.getWithMetadata === "function"
    && typeof binding.put === "function";
}

function isValidTelegramFileId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function getFileParts(id) {
  const value = String(id || "");
  if (!value || value.length > 512 || !/^[A-Za-z0-9._-]+$/.test(value)) return null;
  const extensionIndex = value.lastIndexOf(".");
  const fileId = extensionIndex > 0 ? value.slice(0, extensionIndex) : value;
  return {
    id: value,
    fileId,
    isTelegram: fileId.length > 39,
  };
}

function getShortLinkParts(id) {
  const value = String(id || "");
  const match = /^([A-Za-z0-9_-]{12})\.([a-z0-9]{1,10})$/.exec(value);
  if (!match) return null;
  return {
    id: value,
    fileId: null,
    isTelegram: true,
  };
}

function isAllowedAdminPreview(request, env, origin) {
  const referer = request.headers.get("Referer");
  if (!referer) return false;

  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== origin || !refererUrl.pathname.startsWith("/admin")) return false;
  } catch {
    return false;
  }

  const authState = getBasicAuthState(env);
  if (authState === "disabled") return true;
  if (authState !== "enabled") return false;
  return validateBasicCredentials(request, env) === "valid";
}

async function getTelegramFilePath(env, fileId) {
  if (!env.TG_Bot_Token) return null;

  try {
    const formData = new FormData();
    formData.append("file_id", fileId);
    const response = await fetch(`https://api.telegram.org/bot${env.TG_Bot_Token}/getFile`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      console.warn("Telegram file lookup rejected with status:", response.status);
      return null;
    }

    const data = await response.json().catch(() => null);
    const filePath = data?.ok ? data.result?.file_path : null;
    if (typeof filePath !== "string" || !filePath || filePath.includes("..")) return null;
    return filePath;
  } catch {
    console.warn("Telegram file lookup failed");
    return null;
  }
}

function defaultMetadata(fileId) {
  return {
    ListType: "None",
    Label: "None",
    TimeStamp: Date.now(),
    liked: false,
    fileName: fileId,
    fileSize: 0,
  };
}

function normalizeMetadata(metadata, fileId) {
  const fallback = defaultMetadata(fileId);
  return {
    ...(metadata || {}),
    ListType: metadata?.ListType || fallback.ListType,
    Label: metadata?.Label || fallback.Label,
    TimeStamp: metadata?.TimeStamp || fallback.TimeStamp,
    liked: metadata?.liked === true,
    fileName: metadata?.fileName || fallback.fileName,
    fileSize: Number(metadata?.fileSize || 0),
  };
}

async function saveMetadata(env, id, metadata) {
  try {
    await env.img_url.put(id, "", { metadata });
    return true;
  } catch {
    console.warn("File metadata write failed");
    return false;
  }
}

async function moderateTelegraphFile(env, url) {
  try {
    const moderateUrl = new URL("https://api.moderatecontent.com/moderate/");
    moderateUrl.searchParams.set("key", env.ModerateContentApiKey);
    moderateUrl.searchParams.set("url", `https://telegra.ph${url.pathname}${url.search}`);
    const response = await fetch(moderateUrl);
    if (!response.ok) {
      console.warn("Content moderation rejected with status:", response.status);
      return null;
    }
    const data = await response.json().catch(() => null);
    return typeof data?.rating_label === "string" ? data.rating_label.slice(0, 32) : null;
  } catch {
    console.warn("Content moderation request failed");
    return null;
  }
}

export async function onRequest({ request, env, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonError(405, "method_not_allowed", "Method not allowed");
  }

  const url = new URL(request.url);
  const isShortLink = url.pathname.startsWith("/i/");
  const file = isShortLink ? getShortLinkParts(params.id) : getFileParts(params.id);
  if (!file) return jsonError(400, "invalid_file_id", "Invalid file identifier");

  const hasMetadata = hasFileMetadataBinding(env.img_url);
  let metadataRecord = null;
  let metadataReadFailed = false;
  if (hasMetadata) {
    try {
      metadataRecord = await env.img_url.getWithMetadata(file.id);
    } catch {
      metadataReadFailed = true;
      console.warn("File metadata read failed");
    }
  }

  if (isShortLink) {
    if (!hasMetadata || metadataReadFailed) {
      return jsonError(503, "image_index_unavailable", "File service is not configured");
    }
    const telegramFileId = metadataRecord?.metadata?.telegramFileId;
    if (!isValidTelegramFileId(telegramFileId)) {
      return jsonError(404, "short_link_not_found", "File not found");
    }
    file.fileId = telegramFileId;
  } else {
    const storedTelegramFileId = metadataRecord?.metadata?.telegramFileId;
    if (isValidTelegramFileId(storedTelegramFileId)) {
      file.fileId = storedTelegramFileId;
      file.isTelegram = true;
    }
  }

  let upstreamUrl = `https://telegra.ph${url.pathname}${url.search}`;
  if (file.isTelegram) {
    if (!env.TG_Bot_Token) {
      return jsonError(503, "telegram_not_configured", "File service is not configured");
    }
    const filePath = await getTelegramFilePath(env, file.fileId);
    if (!filePath) {
      return jsonError(502, "telegram_file_unavailable", "File is temporarily unavailable");
    }
    upstreamUrl = `https://api.telegram.org/file/bot${env.TG_Bot_Token}/${filePath}`;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: getSafeProxyHeaders(request),
      redirect: "follow",
    });
  } catch {
    console.warn("External file request failed");
    return jsonError(502, "upstream_file_unavailable", "File is temporarily unavailable");
  }

  if (!upstreamResponse.ok) return upstreamResponse;
  if (isAllowedAdminPreview(request, env, url.origin)) return upstreamResponse;
  if (!hasMetadata || metadataReadFailed) {
    console.warn("File metadata binding is unavailable; serving the public file without metadata checks");
    return upstreamResponse;
  }

  const metadata = normalizeMetadata(metadataRecord?.metadata, file.id);
  let shouldSaveMetadata = !metadataRecord?.metadata;

  if (metadata.ListType === "White") return upstreamResponse;
  if (metadata.ListType === "Block" || metadata.Label === "adult") {
    const redirectUrl = request.headers.get("Referer")
      ? "https://static-res.pages.dev/teleimage/img-block-compressed.png"
      : `${url.origin}/image-blocked.html`;
    return Response.redirect(redirectUrl, 302);
  }
  if (env.WhiteList_Mode === "true") {
    return Response.redirect(`${url.origin}/whitelist-enabled.html`, 302);
  }

  if (env.ModerateContentApiKey && !file.isTelegram) {
    const label = await moderateTelegraphFile(env, url);
    if (label) {
      metadata.Label = label;
      shouldSaveMetadata = true;
      if (label === "adult") {
        await saveMetadata(env, file.id, metadata);
        return Response.redirect(`${url.origin}/image-blocked.html`, 302);
      }
    }
  }

  if (shouldSaveMetadata) await saveMetadata(env, file.id, metadata);
  return upstreamResponse;
}
