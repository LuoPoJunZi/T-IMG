import { getMetadataRecord, jsonResponse } from "../../../utils/manage.js";

export async function onRequest({ env, params }) {
  const record = await getMetadataRecord(env, params.id);
  if (!record) return jsonResponse({ error: "Image metadata not found" }, 404);

  const metadata = { ...record.metadata, ListType: "White" };
  await env.img_url.put(params.id, "", { metadata });
  return jsonResponse(metadata);
}
