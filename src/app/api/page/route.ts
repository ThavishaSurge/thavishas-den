import { checkUrl, describeFetchError, fetchTimed, InputError, isLocalRequest, jsonError, readLimited } from "@/lib/server/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/page?url=… — the page's final URL, status, headers and HTML (up to 4 MB). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  let url: URL;
  try {
    url = await checkUrl(raw, isLocalRequest(req));
  } catch (e) {
    return jsonError(e instanceof InputError ? e.message : "Invalid URL.");
  }
  try {
    const { res, ms } = await fetchTimed(url.toString(), { redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    const html = /html|xml|text/.test(type) || !type ? await readLimited(res) : "";
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return Response.json({ url: res.url || url.toString(), status: res.status, ms, contentType: type, headers, html });
  } catch (e) {
    return jsonError(describeFetchError(e, url.toString()), 502);
  }
}
