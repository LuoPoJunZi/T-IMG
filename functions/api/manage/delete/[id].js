import { jsonResponse } from "../../../utils/manage.js";

export async function onRequest({ env, params }) {
  await env.img_url.delete(params.id);
  return jsonResponse(params.id);
}
