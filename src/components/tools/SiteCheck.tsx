"use client";

import { useEffect, useState } from "react";
import { Check as CheckIcon, ShieldCheck, X, Minus } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Grid, Notice, Panel, Stat, Tabs } from "../ui";
import { normaliseUrl } from "@/lib/web";
import { useQueryParam } from "@/lib/handoff";

type Tab = "headers" | "ssl" | "dns";

interface Hop { url: string; status: number; ms: number; headers: Record<string, string> }
interface SslCert { subject: string; issuer: string; validFrom: string; validTo: string; daysLeft: number; altNames: string[]; keyBits?: number; fingerprint256: string }
interface SslResult { host: string; authorized: boolean; authorizationError: string | null; protocol: string; cipher?: string; hostnameMatches: boolean; cert: SslCert; chain: SslCert[] }
interface DnsResult { name: string; records: Record<string, unknown[]>; dmarc: string[]; www: { cname: string[]; a: { address: string }[] } }

const SEC: { key: string; label: string; why: string; check?: (v: string) => boolean }[] = [
  { key: "strict-transport-security", label: "Strict-Transport-Security", why: "Forces HTTPS on return visits.", check: (v) => /max-age=\d{7,}/.test(v) },
  { key: "content-security-policy", label: "Content-Security-Policy", why: "Limits where scripts can load from — the strongest XSS defence." },
  { key: "x-content-type-options", label: "X-Content-Type-Options", why: "Stops browsers guessing file types.", check: (v) => /nosniff/i.test(v) },
  { key: "x-frame-options", label: "X-Frame-Options", why: "Prevents clickjacking in iframes (or CSP frame-ancestors)." },
  { key: "referrer-policy", label: "Referrer-Policy", why: "Controls what URL is shared when visitors click away." },
  { key: "permissions-policy", label: "Permissions-Policy", why: "Turns off camera, mic and location for embedded content." },
];

function grade(h: Record<string, string>): { letter: string; score: number } {
  let s = 0;
  for (const x of SEC) {
    const v = h[x.key] ?? (x.key === "x-frame-options" && /frame-ancestors/.test(h["content-security-policy"] ?? "") ? "csp" : undefined);
    if (v && (!x.check || x.check(v))) s++;
  }
  const letter = s >= 6 ? "A+" : s === 5 ? "A" : s === 4 ? "B" : s === 3 ? "C" : s === 2 ? "D" : "F";
  return { letter, score: s };
}

function cacheInfo(h: Record<string, string>): string[] {
  const out: string[] = [];
  if (h["cf-cache-status"]) out.push(`Cloudflare cache: ${h["cf-cache-status"]}`);
  if (h["x-litespeed-cache"]) out.push(`LiteSpeed cache: ${h["x-litespeed-cache"]}`);
  if (h["x-cache"]) out.push(`X-Cache: ${h["x-cache"]}`);
  if (h["x-wp-rocket"] || /wp rocket/i.test(h["x-powered-by"] ?? "")) out.push("WP Rocket detected");
  if (h["x-kinsta-cache"]) out.push(`Kinsta cache: ${h["x-kinsta-cache"]}`);
  if (h["x-sucuri-cache"]) out.push(`Sucuri cache: ${h["x-sucuri-cache"]}`);
  if (h["cache-control"]) out.push(`Cache-Control: ${h["cache-control"]}`);
  if (h["content-encoding"]) out.push(`Compressed with ${h["content-encoding"]}`);
  return out;
}

function Headers({ hops }: { hops: Hop[] }) {
  const last = hops[hops.length - 1];
  const h = last.headers;
  const g = grade(h);
  const leaks = ["x-powered-by", "server"].filter((k) => h[k] && /\d/.test(h[k]));
  return (
    <Grid>
      <div className="stack">
        <Panel title="Security headers">
          <div className="sc-grade">
            <span className={`sc-grade__letter sc-grade--${g.score >= 5 ? "add" : g.score >= 3 ? "mod" : "rem"}`}>{g.letter}</span>
            <span className="muted">{g.score} of {SEC.length} recommended headers set on {last.url}</span>
          </div>
          <ul className="sc-list">
            {SEC.map((x) => {
              const v = h[x.key] ?? (x.key === "x-frame-options" && /frame-ancestors/.test(h["content-security-policy"] ?? "") ? "set via CSP frame-ancestors" : undefined);
              const ok = !!v && (!x.check || x.check(v));
              return (
                <li key={x.key}>
                  {ok ? <CheckIcon size={16} className="t-add" /> : v ? <Minus size={16} className="t-mod" /> : <X size={16} className="t-rem" />}
                  <span><strong>{x.label}</strong><span className="muted">{v ? ` ${v.slice(0, 120)}` : ` missing. ${x.why}`}</span></span>
                </li>
              );
            })}
          </ul>
          {leaks.length > 0 && <Notice tone="warn">{leaks.map((k) => `${k}: ${h[k]}`).join(", ")} reveals software versions. Hide it to give attackers less to go on.</Notice>}
          <p className="help">The Config File Generator&rsquo;s .htaccess tab can add the missing ones on Apache/LiteSpeed hosts.</p>
        </Panel>
        {hops.length > 1 && (
          <Panel title="Redirects on the way">
            <ol className="chain">{hops.map((x, i) => <li key={i}><div className="chain__hop"><span className="chip tone-info">{x.status}</span><code className="chain__url">{x.url}</code><span className="muted chain__ms">{x.ms} ms</span></div></li>)}</ol>
          </Panel>
        )}
      </div>
      <div className="stack">
        <Panel title="Performance & caching">
          <div className="kvs">
            <Stat label="status" value={last.status} tone={last.status < 300 ? "add" : "rem"} />
            <Stat label="response time" value={`${last.ms} ms`} tone={last.ms < 600 ? "add" : last.ms < 1500 ? "mod" : "rem"} />
          </div>
          <ul className="warn-list">{cacheInfo(h).map((c) => <li key={c}>{c}</li>)}{!cacheInfo(h).length && <li>No caching or compression headers — a page cache would help.</li>}</ul>
        </Panel>
        <Panel title={`All response headers (${Object.keys(h).length})`} pad={false}>
          <div className="tbl-wrap" style={{ border: 0, maxHeight: 460, overflow: "auto" }}>
            <table className="tbl"><tbody>{Object.entries(h).sort().map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td className="rc-hv">{v}</td></tr>)}</tbody></table>
          </div>
        </Panel>
      </div>
    </Grid>
  );
}

function Ssl({ r }: { r: SslResult }) {
  const c = r.cert;
  const ok = r.authorized && r.hostnameMatches && c.daysLeft > 0;
  return (
    <Grid>
      <Panel title="Certificate">
        <div className={`verdict verdict--${!ok ? "bad" : c.daysLeft < 14 ? "warn" : "ok"}`}>
          <ShieldCheck size={26} />
          <div>
            <strong>{!ok ? (r.authorizationError ?? (r.hostnameMatches ? "Certificate problem" : `Certificate doesn't cover ${r.host}`)) : c.daysLeft < 14 ? `Expires in ${c.daysLeft} days` : "Valid and trusted"}</strong>
            <span>{c.daysLeft > 0 ? `${c.daysLeft} days left, until ${new Date(c.validTo).toLocaleDateString()}` : `Expired on ${new Date(c.validTo).toLocaleDateString()}`}</span>
          </div>
        </div>
        <dl className="dl">
          <div><dt>Issued to</dt><dd>{c.subject}</dd></div>
          <div><dt>Issued by</dt><dd>{c.issuer}</dd></div>
          <div><dt>Valid from</dt><dd>{new Date(c.validFrom).toLocaleString()}</dd></div>
          <div><dt>Protocol</dt><dd>{r.protocol}{r.cipher ? `, ${r.cipher}` : ""}</dd></div>
          {c.keyBits && <div><dt>Key size</dt><dd>{c.keyBits} bits</dd></div>}
          <div><dt>Covers</dt><dd>{c.altNames.slice(0, 20).join(", ")}{c.altNames.length > 20 ? ` +${c.altNames.length - 20} more` : ""}</dd></div>
        </dl>
        {/let's encrypt|r3|r10|r11|e5|e6/i.test(c.issuer) && <p className="help">Let&rsquo;s Encrypt certificates last 90 days and renew automatically — only worry if it&rsquo;s under 20 days.</p>}
      </Panel>
      <Panel title="Chain">
        <ol className="sc-chain">
          {r.chain.map((x, i) => (
            <li key={x.fingerprint256}>
              <span className="chip tone-info">{i === 0 ? "Site" : i === r.chain.length - 1 ? "Root" : "Intermediate"}</span>
              <span><strong>{x.subject || "(no CN)"}</strong><span className="muted"> issued by {x.issuer}, until {new Date(x.validTo).toLocaleDateString()}</span></span>
            </li>
          ))}
        </ol>
        {r.protocol && /TLSv1(\.0|\.1)?$/.test(r.protocol) && <Notice tone="warn">{r.protocol} is outdated. Ask the host to enable TLS 1.2 and 1.3 only.</Notice>}
      </Panel>
    </Grid>
  );
}

function Dns({ r }: { r: DnsResult }) {
  const txt = (r.records.TXT ?? []) as string[];
  const spf = txt.find((t) => /^v=spf1/i.test(t));
  const dmarc = r.dmarc.find((t) => /^v=DMARC1/i.test(t));
  const ns = (r.records.NS ?? []) as string[];
  const provider = ns.some((n) => /cloudflare/.test(n)) ? "Cloudflare" : ns.some((n) => /hostinger|dns-parking/.test(n)) ? "Hostinger" : ns.some((n) => /domaincontrol/.test(n)) ? "GoDaddy" : ns.some((n) => /awsdns/.test(n)) ? "AWS Route 53" : ns.some((n) => /googledomains|google/.test(n)) ? "Google" : ns.some((n) => /namecheap|registrar-servers/.test(n)) ? "Namecheap" : null;
  const checks = [
    { ok: !!(r.records.A?.length || r.records.AAAA?.length), text: "Domain points to a server (A / AAAA)" },
    { ok: !!(r.www.cname.length || r.www.a.length), text: "www resolves" },
    { ok: !!r.records.MX?.length, text: "Mail server (MX) set" },
    { ok: !!spf, text: spf ? `SPF: ${spf}` : "SPF record missing — emails from this domain are more likely to hit spam" },
    { ok: !!dmarc, text: dmarc ? `DMARC: ${dmarc}` : "DMARC record missing (_dmarc TXT)" },
    { ok: !!r.records.CAA?.length, text: r.records.CAA?.length ? "CAA limits who can issue certificates" : "No CAA record (optional)" },
  ];
  const render = (type: string, v: unknown): string => {
    if (typeof v === "string") return v;
    const o = v as Record<string, unknown>;
    if (type === "MX") return `${o.priority} ${o.exchange}`;
    if (type === "A" || type === "AAAA") return `${o.address}  (TTL ${o.ttl})`;
    if (type === "CAA") return `${o.critical ?? 0} ${Object.entries(o).filter(([k]) => k !== "critical").map(([k, x]) => `${k} "${x}"`).join(" ")}`;
    if (type === "SOA") return `${o.nsname} ${o.hostmaster} serial ${o.serial}`;
    return JSON.stringify(v);
  };
  return (
    <Grid>
      <Panel title="Health">
        <ul className="sc-list">{checks.map((c) => <li key={c.text}>{c.ok ? <CheckIcon size={16} className="t-add" /> : <X size={16} className="t-rem" />}<span className="sc-break">{c.text}</span></li>)}</ul>
        {provider && <p className="help">DNS is hosted at <strong>{provider}</strong> — that&rsquo;s where to change these records.</p>}
      </Panel>
      <Panel title={`Records for ${r.name}`} pad={false}>
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table className="tbl">
            <thead><tr><th>Type</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(r.records).flatMap(([t, list]) => (list ?? []).map((v, i) => <tr key={t + i}><td><span className="chip tone-info">{t}</span></td><td className="rc-hv"><code style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{render(t, v)}</code></td></tr>))}
              {r.dmarc.map((v) => <tr key={v}><td><span className="chip tone-info">_dmarc</span></td><td className="rc-hv"><code style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{v}</code></td></tr>)}
            </tbody>
          </table>
        </div>
      </Panel>
    </Grid>
  );
}

export function SiteCheck() {
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("headers");
  const [busy, setBusy] = useState(false);
  const qUrl = useQueryParam("url");
  useEffect(() => { if (qUrl) setInput(qUrl); }, [qUrl]);
  const [data, setData] = useState<{ hops?: Hop[]; ssl?: SslResult; dns?: DnsResult; errors: Partial<Record<Tab, string>> } | null>(null);

  const run = async () => {
    const url = normaliseUrl(input);
    if (!url) return;
    setBusy(true);
    const host = new URL(url).hostname;
    const get = async (u: string) => { const r = await fetch(u); const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; };
    const [h, s, d] = await Promise.allSettled([
      get(`/api/redirects?url=${encodeURIComponent(url)}`),
      get(`/api/ssl?host=${encodeURIComponent(host)}`),
      get(`/api/dns?name=${encodeURIComponent(host.replace(/^www\./, ""))}`),
    ]);
    const errors: Partial<Record<Tab, string>> = {};
    const hops = h.status === "fulfilled" && h.value.hops?.length ? h.value.hops : undefined;
    if (h.status === "rejected") errors.headers = h.reason.message;
    else if (!hops) errors.headers = h.value.error ?? "No response.";
    if (s.status === "rejected") errors.ssl = s.reason.message;
    if (d.status === "rejected") errors.dns = d.reason.message;
    setData({ hops, ssl: s.status === "fulfilled" ? s.value : undefined, dns: d.status === "fulfilled" ? d.value : undefined, errors });
    setBusy(false);
  };

  return (
    <ToolFrame slug="site-check" wide>
      <form className="bp-url" style={{ marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input className="inp" value={input} onChange={(e) => setInput(e.target.value)} placeholder="example.com" aria-label="Domain or URL" />
        <button className="btn btn--lantern" type="submit" disabled={busy || !input.trim()}><ShieldCheck size={15} /> {busy ? "Checking…" : "Check site"}</button>
      </form>
      {!data ? (
        <Panel><Empty icon={<ShieldCheck size={28} />} title="Headers, certificate and DNS in one go">Useful before launch, after moving hosts, or when email from a client&rsquo;s domain keeps landing in spam.</Empty></Panel>
      ) : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[["headers", `HTTP headers${data.errors.headers ? " (error)" : ""}`], ["ssl", `SSL certificate${data.errors.ssl ? " (error)" : ""}`], ["dns", `DNS${data.errors.dns ? " (error)" : ""}`]]} />
          {data.errors[tab] && <Notice tone="error">{data.errors[tab]}</Notice>}
          {tab === "headers" && data.hops && <Headers hops={data.hops} />}
          {tab === "ssl" && data.ssl && <Ssl r={data.ssl} />}
          {tab === "dns" && data.dns && <Dns r={data.dns} />}
        </>
      )}
    </ToolFrame>
  );
}
