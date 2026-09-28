import { checkUrl, describeFetchError, fetchTimed, InputError, isLocalRequest, jsonError, readLimited } from "@/lib/server/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  url: string;
  mode?: "page" | "site";
  maxPages?: number;
  maxLinks?: number;
  external?: boolean;
  assets?: boolean;
}

const SKIP = /^(mailto:|tel:|javascript:|data:|sms:|whatsapp:|#)/i;

function extractLinks(html: string, base: string, assets: boolean): { url: string; kind: string; text: string }[] {
  const out: { url: string; kind: string; text: string }[] = [];
  const add = (raw: string, kind: string, text = "") => {
    const v = raw.trim().replace(/&amp;/g, "&");
    if (!v || SKIP.test(v)) return;
    try {
      const u = new URL(v, base);
      if (!/^https?:$/.test(u.protocol)) return;
      u.hash = "";
      out.push({ url: u.toString(), kind, text: text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) });
    } catch { /* bad URL */ }
  };
  const baseTag = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  if (baseTag) base = new URL(baseTag[1], base).toString();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) add(m[2], "link", m[3]);
  if (assets) {
    for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) add(m[2], "image");
    for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) add(m[2], "script");
    for (const m of html.matchAll(/<link\b[^>]*?\brel\s*=\s*(["'])stylesheet\1[^>]*?\bhref\s*=\s*(["'])(.*?)\2/gi)) add(m[3], "stylesheet");
  }
  return out;
}

async function check(url: string, local: boolean): Promise<{ status: number; ms: number; error?: string; finalUrl?: string; type?: string }> {
  try {
    await checkUrl(url, local);
    let { res, ms } = await fetchTimed(url, { method: "HEAD", redirect: "follow", timeoutMs: 12000 });
    if ([403, 405, 501, 400, 404, 429].includes(res.status) || res.status >= 500) {
      // many servers mishandle HEAD — confirm with GET before calling it broken
      try { await res.body?.cancel(); } catch { /* ignore */ }
      ({ res, ms } = await fetchTimed(url, { method: "GET", redirect: "follow", timeoutMs: 15000 }));
    }
    const type = res.headers.get("content-type") ?? "";
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return { status: res.status, ms, finalUrl: res.url, type };
  } catch (e) {
    return { status: 0, ms: 0, error: e instanceof InputError ? e.message : describeFetchError(e, url) };
  }
}

/** POST /api/links — streams NDJSON events while crawling. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Send JSON with a url.");
  }
  const local = isLocalRequest(req);
  let start: URL;
  try {
    start = await checkUrl(body.url, local);
  } catch (e) {
    return jsonError(e instanceof InputError ? e.message : "Invalid URL.");
  }
  const mode = body.mode ?? "page";
  const maxPages = Math.min(Math.max(1, body.maxPages ?? 20), 100);
  const maxLinks = Math.min(Math.max(10, body.maxLinks ?? 300), 1500);
  const external = body.external ?? true;
  const assets = body.assets ?? false;
  const origin = start.origin;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const pages: string[] = [start.toString()];
      const seenPages = new Set(pages);
      const checked = new Map<string, { status: number; error?: string; finalUrl?: string }>();
      const sources = new Map<string, { page: string; text: string; kind: string }[]>();
      let pageCount = 0;
      let linkCount = 0;
      let broken = 0;

      try {
        while (pages.length && pageCount < maxPages && linkCount < maxLinks) {
          if (req.signal.aborted) break;
          const pageUrl = pages.shift()!;
          // don't crawl pages we already know are broken, or redirects to pages already queued
          const known = checked.get(pageUrl) as { status: number; finalUrl?: string } | undefined;
          if (known && (known.status === 0 || known.status >= 400)) continue;
          if (known?.finalUrl && known.finalUrl !== pageUrl && seenPages.has(known.finalUrl)) continue;
          if (known?.finalUrl && known.finalUrl !== pageUrl) seenPages.add(known.finalUrl);
          pageCount++;
          let html = "";
          let pageStatus = 0;
          try {
            const { res, ms } = await fetchTimed(pageUrl, { redirect: "follow" });
            pageStatus = res.status;
            const isHtml = /html/.test(res.headers.get("content-type") ?? "");
            html = isHtml ? await readLimited(res, 3_000_000) : "";
            send({ type: "page", url: pageUrl, status: res.status, ms, n: pageCount });
          } catch (e) {
            send({ type: "page", url: pageUrl, status: 0, error: describeFetchError(e, pageUrl), n: pageCount });
            continue;
          }
          if (!html || pageStatus >= 400) continue;

          const found = extractLinks(html, pageUrl, assets);
          const fresh: string[] = [];
          for (const l of found) {
            const list = sources.get(l.url) ?? [];
            if (list.length < 5 && !list.some((s) => s.page === pageUrl)) list.push({ page: pageUrl, text: l.text, kind: l.kind });
            sources.set(l.url, list);
            const internal = new URL(l.url).origin === origin;
            if (!internal && !external) continue;
            if (!checked.has(l.url) && !fresh.includes(l.url)) fresh.push(l.url);
            if (mode === "site" && internal && l.kind === "link" && !seenPages.has(l.url) && !/\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|css|js|xml)(\?|$)/i.test(l.url) && !/\/wp-(admin|login)|\/feed\/?$|[?&](replytocom|add-to-cart)=/.test(l.url)) {
              seenPages.add(l.url);
              pages.push(l.url);
            }
          }

          // check new links, 8 at a time
          const todo = fresh.slice(0, maxLinks - linkCount);
          for (let i = 0; i < todo.length; i += 8) {
            if (req.signal.aborted) break;
            const batch = todo.slice(i, i + 8);
            const results = await Promise.all(batch.map((u) => check(u, local)));
            batch.forEach((u, k) => {
              const r = results[k];
              checked.set(u, r);
              linkCount++;
              const bad = r.status === 0 || r.status >= 400;
              if (bad) broken++;
              send({
                type: "link", url: u, status: r.status, ms: r.ms, error: r.error, finalUrl: r.finalUrl !== u ? r.finalUrl : undefined,
                internal: new URL(u).origin === origin, sources: sources.get(u) ?? [], broken: bad,
              });
            });
          }
        }
        send({ type: "done", pages: pageCount, links: linkCount, broken, capped: linkCount >= maxLinks || (pages.length > 0 && pageCount >= maxPages) });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Crawl failed." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
