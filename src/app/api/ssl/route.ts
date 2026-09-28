import tls from "node:tls";
import { checkUrl, InputError, isLocalRequest, jsonError } from "@/lib/server/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cert = tls.DetailedPeerCertificate;

function summarise(c: Cert) {
  const to = new Date(c.valid_to);
  return {
    subject: c.subject?.CN ?? "",
    issuer: [c.issuer?.O, c.issuer?.CN].filter(Boolean).join(", "),
    validFrom: new Date(c.valid_from).toISOString(),
    validTo: to.toISOString(),
    daysLeft: Math.floor((to.getTime() - Date.now()) / 86400000),
    serial: c.serialNumber,
    fingerprint256: c.fingerprint256,
    altNames: (c.subjectaltname ?? "").split(",").map((s) => s.trim().replace(/^DNS:/, "")).filter(Boolean),
    keyBits: c.bits,
  };
}

/** GET /api/ssl?host=example.com[:port] */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("host");
  let u: URL;
  try {
    u = await checkUrl(raw, isLocalRequest(req));
  } catch (e) {
    return jsonError(e instanceof InputError ? e.message : "Invalid host.");
  }
  const host = u.hostname;
  const port = Number(u.port) || 443;
  try {
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const t0 = performance.now();
      const sock = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: 12000 }, () => {
        const cert = sock.getPeerCertificate(true);
        const chain: ReturnType<typeof summarise>[] = [];
        let c: Cert | undefined = cert;
        const seen = new Set<string>();
        while (c && c.fingerprint256 && !seen.has(c.fingerprint256) && chain.length < 5) {
          seen.add(c.fingerprint256);
          chain.push(summarise(c));
          c = c.issuerCertificate;
        }
        const out = {
          host, port,
          authorized: sock.authorized,
          authorizationError: sock.authorizationError ? String(sock.authorizationError) : null,
          protocol: sock.getProtocol(),
          cipher: sock.getCipher()?.name,
          ms: Math.round(performance.now() - t0),
          hostnameMatches: !tls.checkServerIdentity(host, cert),
          cert: chain[0],
          chain,
        };
        sock.end();
        resolve(out);
      });
      sock.on("timeout", () => { sock.destroy(); reject(new Error(`${host}:${port} didn't answer within 12 seconds.`)); });
      sock.on("error", (e) => reject(e));
    });
    return Response.json(result);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const msg = err.code === "ENOTFOUND" ? `Couldn't find ${host} in DNS.` : err.code === "ECONNREFUSED" ? `${host} isn't accepting connections on port ${port}.` : err.message;
    return jsonError(msg, 502);
  }
}
