/* Client helpers for the Den's server routes. */

export interface PageResult {
  url: string;
  status: number;
  ms: number;
  contentType: string;
  headers: Record<string, string>;
  html: string;
}

export async function fetchPage(url: string): Promise<PageResult> {
  const r = await fetch(`/api/page?url=${encodeURIComponent(url)}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "Couldn't load that page.");
  return d as PageResult;
}

export interface MetaInfo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: Record<string, string>;
  twitter: Record<string, string>;
  lang: string;
  favicon: string;
}

export function readMeta(html: string, base: string): MetaInfo {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (sel: string) => doc.querySelector<HTMLMetaElement>(sel)?.content?.trim() ?? "";
  const abs = (u: string) => {
    try { return u ? new URL(u, base).toString() : ""; } catch { return u; }
  };
  const og: Record<string, string> = {};
  doc.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach((m) => (og[m.getAttribute("property")!.slice(3)] = m.content));
  const twitter: Record<string, string> = {};
  doc.querySelectorAll<HTMLMetaElement>('meta[name^="twitter:"]').forEach((m) => (twitter[m.getAttribute("name")!.slice(8)] = m.content));
  if (og.image) og.image = abs(og.image);
  if (twitter.image) twitter.image = abs(twitter.image);
  return {
    title: doc.querySelector("title")?.textContent?.trim() ?? "",
    description: meta('meta[name="description"]'),
    canonical: abs(doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute("href") ?? ""),
    robots: meta('meta[name="robots"]'),
    og,
    twitter,
    lang: doc.documentElement.lang,
    favicon: abs(doc.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute("href") ?? "/favicon.ico"),
  };
}

export function normaliseUrl(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : (/^(localhost|127\.|192\.168\.|[\w-]+\.local)/.test(t) ? "http://" : "https://") + t;
}
