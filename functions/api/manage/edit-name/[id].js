// Canonical kebab-case management route.
import { getMetadataRecord, jsonResponse, validateDisplayName } from "../../../utils/manage.js";

export async function onRequest({ request, params, env }) {
  const newName = validateDisplayName(new URL(request.url).searchParams.get("newName"));
  if (!newName) return jsonResponse({ error: "Invalid file name" }, 400);

  const record = await getMetadataRecord(env, params.id);
  if (!record) return jsonResponse({ error: "Image metadata not found" }, 404);

  const metadata = { ...record.metadata, fileName: newName };
  await env.img_url.put(params.id, "", { metadata });
  return jsonResponse({ success: true, fileName: metadata.fileName });
}
