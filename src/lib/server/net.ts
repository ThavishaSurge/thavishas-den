import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 ThavishasDen/1.0";

export class InputError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v === "::";
}

/** True when the Den itself is being used from this machine (localhost), so local dev sites can be checked. */
export function isLocalRequest(req: Request): boolean {
  const host = new URL(req.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * Normalises a user URL and, when the Den is used over the internet, refuses to fetch private
 * network addresses so its server routes can't be used to probe the host's own network.
 * Local use (http://localhost:3000) and DEN_ALLOW_PRIVATE=1 lift the restriction.
 */
export async function checkUrl(raw: string | null, allowLocal = false): Promise<URL> {
  if (!raw || !raw.trim()) throw new InputError("Enter a URL.");
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new InputError(`"${raw}" isn't a valid URL.`);
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new InputError("Only http and https URLs can be checked.");
  const allowPrivate = allowLocal || process.env.DEN_ALLOW_PRIVATE === "1" || process.env.NODE_ENV !== "production";
  if (!allowPrivate) {
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
    if (!ips.length) throw new InputError(`Couldn't find ${u.hostname} in DNS.`);
    if (ips.some(isPrivateIp)) throw new InputError("Private and local network addresses are blocked on this deployment. Set DEN_ALLOW_PRIVATE=1 to allow them.");
  }
  return u;
}

export async function fetchTimed(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ res: Response; ms: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en;q=0.9", ...(init.headers ?? {}) },
      cache: "no-store",
    });
    return { res, ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(t);
  }
}

export function describeFetchError(e: unknown, url: string): string {
  const err = e as Error & { cause?: { code?: string; message?: string } };
  const code = err.cause?.code;
  if (err.name === "AbortError") return `${url} didn't respond within 15 seconds.`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `Couldn't find ${new URL(url).hostname} — check the domain spelling or DNS.`;
  if (code === "ECONNREFUSED") return `${new URL(url).host} refused the connection.`;
  if (code?.startsWith("ERR_TLS") || code?.includes("CERT") || /certificate/i.test(err.cause?.message ?? "")) return `SSL problem on ${new URL(url).hostname}: ${err.cause?.message ?? code}`;
  return err.cause?.message ?? err.message ?? "The request failed.";
}

export async function readLimited(res: Response, maxBytes = 4_000_000): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(value);
    if (size > maxBytes) {
      await reader.cancel();
      break;
    }
  }
  const all = new Uint8Array(Math.min(size, maxBytes + 65536));
  let off = 0;
  for (const c of chunks) {
    if (off + c.length > all.length) break;
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder("utf-8").decode(all.subarray(0, off));
}

export interface Hop {
  url: string;
  status: number;
  statusText: string;
  location: string | null;
  ms: number;
  headers: Record<string, string>;
}

/** Follows redirects one hop at a time so every status and header is visible. */
export async function followRedirects(start: URL, method: "GET" | "HEAD" = "GET", allowLocal = false, maxHops = 12): Promise<{ hops: Hop[]; loop: boolean; error?: string }> {
  const hops: Hop[] = [];
  let current = start.toString();
  const seen = new Set<string>();
  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current)) return { hops, loop: true };
    seen.add(current);
    let r: { res: Response; ms: number };
    try {
      await checkUrl(current, allowLocal);
      r = await fetchTimed(current, { method, redirect: "manual" });
    } catch (e) {
      return { hops, loop: false, error: e instanceof InputError ? e.message : describeFetchError(e, current) };
    }
    const headers: Record<string, string> = {};
    r.res.headers.forEach((v, k) => (headers[k] = v));
    const loc = r.res.headers.get("location");
    const next = loc ? new URL(loc, current).toString() : null;
    hops.push({ url: current, status: r.res.status, statusText: r.res.statusText, location: next, ms: r.ms, headers });
    try { await r.res.body?.cancel(); } catch { /* ignore */ }
    if (r.res.status >= 300 && r.res.status < 400 && next) current = next;
    else return { hops, loop: false };
  }
  return { hops, loop: false, error: `Stopped after ${maxHops} redirects.` };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
