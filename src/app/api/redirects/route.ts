import { checkUrl, followRedirects, InputError, isLocalRequest, jsonError } from "@/lib/server/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/redirects?url=…&method=GET|HEAD — every hop with status, timing and headers. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const local = isLocalRequest(req);
    const url = await checkUrl(q.get("url"), local);
    const method = q.get("method") === "HEAD" ? "HEAD" : "GET";
    const result = await followRedirects(url, method, local);
    return Response.json({ start: url.toString(), ...result });
  } catch (e) {
    return jsonError(e instanceof InputError ? e.message : "Couldn't check that URL.", e instanceof InputError ? 400 : 500);
  }
}
