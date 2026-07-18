// Canonical kebab-case management route.
import { getMetadataRecord, jsonResponse } from "../../../utils/manage.js";

export async function onRequest({ params, env }) {
  const record = await getMetadataRecord(env, params.id);
  if (!record) return jsonResponse({ error: "Image metadata not found" }, 404);

  const metadata = { ...record.metadata, liked: !Boolean(record.metadata.liked) };
  await env.img_url.put(params.id, "", { metadata });
  return jsonResponse({ success: true, liked: metadata.liked });
}
