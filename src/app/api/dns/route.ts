import dns from "node:dns/promises";
import { jsonError } from "@/lib/server/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA"] as const;
type T = (typeof TYPES)[number];

async function lookup(r: dns.Resolver, name: string, type: T): Promise<unknown[]> {
  try {
    switch (type) {
      case "A": return await r.resolve4(name, { ttl: true });
      case "AAAA": return await r.resolve6(name, { ttl: true });
      case "CNAME": return await r.resolveCname(name);
      case "MX": return (await r.resolveMx(name)).sort((a, b) => a.priority - b.priority);
      case "TXT": return (await r.resolveTxt(name)).map((parts) => parts.join(""));
      case "NS": return await r.resolveNs(name);
      case "CAA": return await r.resolveCaa(name);
      case "SOA": return [await r.resolveSoa(name)];
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ESERVFAIL" || code === "NOTFOUND") return [];
    throw e;
  }
}

/** GET /api/dns?name=example.com */
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("name") ?? "").trim().toLowerCase();
  const name = raw.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) return jsonError("Enter a domain like example.com.");
  const r = new dns.Resolver({ timeout: 5000, tries: 2 });
  if (process.env.DEN_DNS_SERVERS) r.setServers(process.env.DEN_DNS_SERVERS.split(","));
  try {
    const records: Partial<Record<T, unknown[]>> = {};
    await Promise.all(TYPES.map(async (t) => { records[t] = await lookup(r, name, t); }));
    const [dmarc, wwwCname, wwwA] = await Promise.all([
      lookup(r, `_dmarc.${name}`, "TXT"),
      lookup(r, `www.${name}`, "CNAME"),
      lookup(r, `www.${name}`, "A"),
    ]);
    const nothing = Object.values(records).every((v) => !v || v.length === 0);
    if (nothing) return jsonError(`No DNS records found for ${name}. Check the spelling, or the domain may not be registered.`, 404);
    return Response.json({ name, records, dmarc, www: { cname: wwwCname, a: wwwA } });
  } catch (e) {
    return jsonError(`DNS lookup failed: ${(e as Error).message}`, 502);
  }
}
