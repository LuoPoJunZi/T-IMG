import { getUploadRequestAuthorization, isSameOriginRequest } from "./upload-auth.js";

// The public Bot API can accept larger documents, but getFile downloads are
// limited to 20 MiB. Keep uploads retrievable through this application's proxy.
const TELEGRAM_MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const TELEGRAM_PHOTO_MAX_SIZE = 10 * 1024 * 1024;
const MAX_NETWORK_RETRIES = 2;
const SHORT_CODE_BYTE_LENGTH = 9;

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "text/plain": "txt",
};

class UploadError extends Error {
  constructor(status, code, publicMessage) {
    super(code);
    this.name = "UploadError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function requireUploadServiceConfig(env = {}) {
  const botToken = typeof env.TG_Bot_Token === "string" ? env.TG_Bot_Token.trim() : "";
  const chatId = typeof env.TG_Chat_ID === "string" ? env.TG_Chat_ID.trim() : "";
  const missingTelegramBindings = [];
  if (!botToken) missingTelegramBindings.push("TG_Bot_Token");
  if (!chatId) missingTelegramBindings.push("TG_Chat_ID");

  if (missingTelegramBindings.length > 0) {
    console.error("Upload configuration missing:", missingTelegramBindings.join(", "));
    throw new UploadError(503, "telegram_not_configured", "Upload service is not configured");
  }

  if (!env.img_url || typeof env.img_url.put !== "function") {
    console.error("Upload configuration missing or invalid: img_url");
    throw new UploadError(503, "image_index_not_configured", "Upload service is not configured");
  }

  return {
    botToken,
    chatId,
    imageIndex: env.img_url,
  };
}

function resolveUploadLimit(env) {
  const configured = Number.parseInt(env.MAX_UPLOAD_SIZE_BYTES || "", 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return TELEGRAM_MAX_UPLOAD_SIZE;
  }
  return Math.min(configured, TELEGRAM_MAX_UPLOAD_SIZE);
}

function sanitizeFileName(fileName) {
  const cleaned = String(fileName || "upload")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned || "upload";
}

function getSafeExtension(fileName, mimeType) {
  const dotIndex = fileName.lastIndexOf(".");
  const candidate = dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
  if (/^[a-z0-9]{1,10}$/.test(candidate)) {
    return candidate;
  }
  return MIME_EXTENSIONS[mimeType] || "bin";
}

function createShortCode() {
  const bytes = new Uint8Array(SHORT_CODE_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getTelegramTarget(uploadFile) {
  const mimeType = String(uploadFile.type || "").toLowerCase();
  if (mimeType.startsWith("image/") && uploadFile.size <= TELEGRAM_PHOTO_MAX_SIZE) {
    return { endpoint: "sendPhoto", field: "photo" };
  }
  if (mimeType.startsWith("audio/")) {
    return { endpoint: "sendAudio", field: "audio" };
  }
  if (mimeType.startsWith("video/")) {
    return { endpoint: "sendVideo", field: "video" };
  }
  return { endpoint: "sendDocument", field: "document" };
}

function validateUploadFile(uploadFile, env) {
  if (!uploadFile || typeof uploadFile !== "object" || typeof uploadFile.arrayBuffer !== "function") {
    throw new UploadError(400, "file_missing", "No file uploaded");
  }
  if (!Number.isFinite(uploadFile.size) || uploadFile.size <= 0) {
    throw new UploadError(400, "file_empty", "Uploaded file is empty");
  }
  if (uploadFile.size > resolveUploadLimit(env)) {
    throw new UploadError(413, "file_too_large", "Uploaded file exceeds the allowed size");
  }
}

function createTelegramFormData(uploadFile, uploadConfig, target) {
  const formData = new FormData();
  formData.append("chat_id", uploadConfig.chatId);
  formData.append(target.field, uploadFile, sanitizeFileName(uploadFile.name));
  return formData;
}

async function waitBeforeRetry(retryCount) {
  await new Promise((resolve) => setTimeout(resolve, 250 * (retryCount + 1)));
}

async function sendToTelegram(uploadFile, target, uploadConfig, retryCount = 0) {
  const apiUrl = `https://api.telegram.org/bot${uploadConfig.botToken}/${target.endpoint}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: createTelegramFormData(uploadFile, uploadConfig, target),
    });
    const responseData = await response.json().catch(() => null);

    if (response.ok && responseData?.ok) {
      return responseData;
    }

    if (target.endpoint === "sendPhoto") {
      return sendToTelegram(
        uploadFile,
        { endpoint: "sendDocument", field: "document" },
        uploadConfig,
        retryCount,
      );
    }

    console.warn("Telegram upload rejected with status:", response.status);
    throw new UploadError(502, "telegram_upload_failed", "Upload service rejected the file");
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }
    if (retryCount < MAX_NETWORK_RETRIES) {
      await waitBeforeRetry(retryCount);
      return sendToTelegram(uploadFile, target, uploadConfig, retryCount + 1);
    }
    console.warn("Telegram upload failed after network retries");
    throw new UploadError(502, "telegram_network_error", "Upload service is temporarily unavailable");
  }
}

function getFileId(response) {
  const result = response?.result;
  if (!response?.ok || !result) return null;

  if (Array.isArray(result.photo) && result.photo.length > 0) {
    return result.photo.reduce((largest, current) =>
      (Number(largest.file_size || 0) > Number(current.file_size || 0) ? largest : current),
    ).file_id;
  }
  return result.document?.file_id || result.video?.file_id || result.audio?.file_id || null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!isSameOriginRequest(request)) {
      throw new UploadError(403, "cross_site_request", "Upload request was rejected");
    }

    const authorization = await getUploadRequestAuthorization(request, env);
    if (authorization.state === "configuration_error") {
      throw new UploadError(503, "upload_auth_not_configured", "Upload access protection is not configured");
    }
    if (authorization.state !== "authorized") {
      throw new UploadError(401, "upload_auth_required", "Upload authentication is required");
    }

    const uploadConfig = requireUploadServiceConfig(env);

    let formData;
    try {
      formData = await request.formData();
    } catch {
      throw new UploadError(400, "invalid_form_data", "Invalid upload request");
    }

    const uploadFile = formData.get("file");
    validateUploadFile(uploadFile, env);

    const fileName = sanitizeFileName(uploadFile.name);
    const fileExtension = getSafeExtension(fileName, String(uploadFile.type || "").toLowerCase());
    const telegramResponse = await sendToTelegram(
      uploadFile,
      getTelegramTarget(uploadFile),
      uploadConfig,
    );
    const fileId = getFileId(telegramResponse);

    if (!fileId || fileId.length > 512 || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
      throw new UploadError(502, "telegram_invalid_response", "Upload service returned an invalid response");
    }

    const legacyStorageKey = `${fileId}.${fileExtension}`;
    const storageKey = `${createShortCode()}.${fileExtension}`;
    let publicPath = `/i/${storageKey}`;
    try {
      await uploadConfig.imageIndex.put(storageKey, "", {
        metadata: {
          TimeStamp: Date.now(),
          ListType: "None",
          Label: "None",
          liked: false,
          fileName,
          fileSize: uploadFile.size,
          telegramFileId: fileId,
        },
      });
    } catch {
      // Telegram already accepted the file. Reporting a failure here would encourage
      // a duplicate upload. The legacy path remains usable without a KV alias.
      console.warn("Upload metadata write failed after Telegram accepted the file");
      publicPath = `/file/${legacyStorageKey}`;
    }

    return jsonResponse([{ src: publicPath }], 200);
  } catch (error) {
    const knownError = error instanceof UploadError;
    const status = knownError ? error.status : 500;
    const code = knownError ? error.code : "internal_error";
    const message = knownError ? error.publicMessage : "Upload failed";
    console.error("Upload request failed:", code);
    return jsonResponse({ error: message, code }, status, { "Cache-Control": "no-store" });
  }
}
