export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function getMetadataRecord(env, id) {
  const record = await env.img_url.getWithMetadata(id);
  if (!record?.metadata) return null;
  return record;
}

export function validateDisplayName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) {
    return null;
  }
  return name;
}
