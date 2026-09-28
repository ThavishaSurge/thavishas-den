"use client";

import { useEffect, useMemo, useState } from "react";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { ArrowDownUp, FileUp } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Notice, Output, Panel, Segmented, Tabs, TextArea, TextInput } from "../ui";
import { CopyButton } from "../CopyButton";

type Tab = "base64" | "url" | "html" | "jwt" | "hash";

/* ---------- helpers ---------- */

function b64encode(text: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const out = btoa(bin);
  return urlSafe ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : out;
}

function b64decodeBytes(b64: string): Uint8Array {
  let s = b64.trim().replace(/\s+/g, "").replace(/^data:[^,]*,/, "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64decode(b64: string): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(b64decodeBytes(b64));
}

const NAMED: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;", " ": "&nbsp;", "©": "&copy;", "®": "&reg;", "™": "&trade;", "–": "&ndash;", "—": "&mdash;", "‘": "&lsquo;", "’": "&rsquo;", "“": "&ldquo;", "”": "&rdquo;", "…": "&hellip;", "€": "&euro;", "£": "&pound;" };

function htmlEncode(s: string, allNonAscii: boolean): string {
  return Array.from(s)
    .map((ch) => {
      if (NAMED[ch] && (allNonAscii || "&<>\"'".includes(ch))) return NAMED[ch];
      if (allNonAscii && ch.codePointAt(0)! > 126) return `&#${ch.codePointAt(0)};`;
      return ch;
    })
    .join("");
}

function htmlDecode(s: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><textarea>${s.replace(/<\/textarea/gi, "&lt;/textarea")}</textarea>`, "text/html");
  return doc.querySelector("textarea")?.value ?? s;
}

/* ---------- tabs ---------- */

function Base64Tab() {
  const [dir, setDir] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [fileOut, setFileOut] = useState<string | null>(null);
  let out = "";
  let err: string | null = null;
  try {
    out = input ? (dir === "encode" ? b64encode(input, urlSafe) : b64decode(input)) : "";
  } catch {
    err = "That isn't valid Base64. Check for missing characters or stray symbols.";
  }
  return (
    <div className="grid grid--2">
      <Panel
        title={dir === "encode" ? "Text" : "Base64"}
        actions={
          <>
            <Segmented label="Direction" value={dir} onChange={(d) => { setDir(d); setInput(out && !err ? out : ""); }} options={[["encode", "Encode"], ["decode", "Decode"]]} />
          </>
        }
      >
        <TextArea code value={input} onChange={(e) => setInput(e.target.value)} rows={12} placeholder={dir === "encode" ? "Text to encode" : "Base64 to decode (data: URIs work too)"} />
        {dir === "encode" && <Check label="URL-safe alphabet (- and _ , no padding)" checked={urlSafe} onChange={setUrlSafe} />}
        <label className="btn btn--sm" style={{ alignSelf: "flex-start" }}>
          <FileUp size={14} /> Encode a file as a data URI
          <input
            type="file"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => setFileOut(String(r.result));
              r.readAsDataURL(f);
              e.target.value = "";
            }}
          />
        </label>
      </Panel>
      <Panel title={dir === "encode" ? "Base64" : "Decoded text"}>
        {err ? <Notice tone="error">{err}</Notice> : <Output value={out} maxHeight={320} />}
        {fileOut && (
          <>
            <Output value={fileOut} label={`Data URI (${Math.round(fileOut.length / 1024)} KB)`} maxHeight={160} />
            {fileOut.startsWith("data:image/") && <img src={fileOut} alt="Preview of encoded file" className="ed-img" />}
          </>
        )}
      </Panel>
    </div>
  );
}

function UrlTab() {
  const [dir, setDir] = useState<"encode" | "decode">("encode");
  const [whole, setWhole] = useState(false);
  const [input, setInput] = useState("");
  let out = "";
  let err: string | null = null;
  try {
    out = !input ? "" : dir === "encode" ? (whole ? encodeURI(input) : encodeURIComponent(input)) : decodeURIComponent(input.replace(/\+/g, " "));
  } catch {
    err = "This contains a broken % sequence, so it can't be decoded.";
  }
  const params = useMemo(() => {
    const src = dir === "decode" ? input : out;
    try {
      const u = new URL(src.includes("://") ? src : `https://x.invalid/?${src.replace(/^\?/, "")}`);
      return [...u.searchParams.entries()];
    } catch {
      return [];
    }
  }, [input, out, dir]);

  return (
    <div className="grid grid--2">
      <Panel title="Input" actions={<Segmented label="Direction" value={dir} onChange={setDir} options={[["encode", "Encode"], ["decode", "Decode"]]} />}>
        <TextArea code value={input} onChange={(e) => setInput(e.target.value)} rows={8} placeholder={dir === "encode" ? "Text or URL to encode" : "Encoded URL or query string"} />
        {dir === "encode" && <Check label="Encode a whole URL" hint="Keeps : / ? & = intact (encodeURI)" checked={whole} onChange={setWhole} />}
      </Panel>
      <Panel title="Output">
        {err ? <Notice tone="error">{err}</Notice> : <Output value={out} maxHeight={220} />}
        {params.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Query parameter</th><th>Value</th></tr></thead>
              <tbody>{params.map(([k, v], i) => <tr key={i}><td><code>{k}</code></td><td><code>{v}</code></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function HtmlTab() {
  const [dir, setDir] = useState<"encode" | "decode">("encode");
  const [all, setAll] = useState(false);
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut(!input ? "" : dir === "encode" ? htmlEncode(input, all) : htmlDecode(input));
  }, [input, dir, all]);
  return (
    <div className="grid grid--2">
      <Panel title="Input" actions={<Segmented label="Direction" value={dir} onChange={setDir} options={[["encode", "Encode"], ["decode", "Decode"]]} />}>
        <TextArea code value={input} onChange={(e) => setInput(e.target.value)} rows={10} placeholder={dir === "encode" ? '<a href="#">Café & Co</a>' : "&lt;p&gt;Caf&eacute;&lt;/p&gt;"} />
        {dir === "encode" && <Check label="Also encode accents, symbols and emoji" hint="Useful for emails and old systems" checked={all} onChange={setAll} />}
      </Panel>
      <Panel title="Output"><Output value={out} maxHeight={300} /></Panel>
    </div>
  );
}

function JwtTab() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const parsed = useMemo(() => {
    const t = token.trim().replace(/^Bearer\s+/i, "");
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length < 2) return { error: "A JWT has three parts separated by dots." };
    try {
      const header = JSON.parse(b64decode(parts[0]));
      const payload = JSON.parse(b64decode(parts[1]));
      return { header, payload, parts };
    } catch {
      return { error: "The header or payload isn't valid Base64-encoded JSON." };
    }
  }, [token]);

  const verified = useMemo(() => {
    if (!parsed || "error" in parsed || !secret || !parsed.parts[2]) return null;
    const alg = String(parsed.header.alg);
    const fn = alg === "HS256" ? sha256 : alg === "HS384" ? sha384 : alg === "HS512" ? sha512 : null;
    if (!fn) return "unsupported";
    const sig = hmac(fn, utf8ToBytes(secret), utf8ToBytes(`${parsed.parts[0]}.${parsed.parts[1]}`));
    const expected = b64decodeBytes(parsed.parts[2]);
    return sig.length === expected.length && sig.every((b, i) => b === expected[i]) ? "valid" : "invalid";
  }, [parsed, secret]);

  const now = Date.now() / 1000;
  const p = parsed && !("error" in parsed) ? (parsed.payload as Record<string, unknown>) : null;
  const time = (k: string) => (typeof p?.[k] === "number" ? new Date((p[k] as number) * 1000) : null);
  const exp = time("exp"), iat = time("iat"), nbf = time("nbf");

  return (
    <div className="grid grid--2">
      <Panel title="Token">
        <TextArea code value={token} onChange={(e) => setToken(e.target.value)} rows={8} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…" className="jwt-area" />
        <TextInput label="Secret (optional)" hint="Checks HS256 / HS384 / HS512 signatures. Stays in this tab." value={secret} onChange={(e) => setSecret(e.target.value)} type="password" autoComplete="off" />
        {verified === "valid" && <Notice tone="ok">Signature is valid for this secret.</Notice>}
        {verified === "invalid" && <Notice tone="error">Signature does not match this secret.</Notice>}
        {verified === "unsupported" && <Notice tone="warn">Only HMAC (HS*) signatures can be checked here.</Notice>}
      </Panel>
      <Panel title="Decoded">
        {!parsed && <p className="help">Paste a token to decode it. Decoding doesn&rsquo;t verify it — anyone can read a JWT&rsquo;s contents.</p>}
        {parsed && "error" in parsed && <Notice tone="error">{parsed.error}</Notice>}
        {parsed && !("error" in parsed) && (
          <>
            <div className="kvs">
              {exp && (
                <div className={`kv ${exp.getTime() / 1000 < now ? "kv--rem" : "kv--add"}`}>
                  <span className="kv__value" style={{ fontSize: 20 }}>{exp.getTime() / 1000 < now ? "Expired" : "Active"}</span>
                  <span className="kv__label">expires {exp.toLocaleString()}</span>
                </div>
              )}
              {iat && <div className="kv"><span className="kv__value" style={{ fontSize: 20 }}>{iat.toLocaleDateString()}</span><span className="kv__label">issued {iat.toLocaleTimeString()}</span></div>}
              {nbf && <div className="kv"><span className="kv__value" style={{ fontSize: 20 }}>{nbf.toLocaleDateString()}</span><span className="kv__label">not valid before</span></div>}
            </div>
            <Output value={JSON.stringify(parsed.header, null, 2)} label="Header" />
            <Output value={JSON.stringify(parsed.payload, null, 2)} label="Payload" maxHeight={340} />
          </>
        )}
      </Panel>
    </div>
  );
}

const ALGOS = [
  ["MD5", md5], ["SHA-1", sha1], ["SHA-256", sha256], ["SHA-384", sha384], ["SHA-512", sha512],
] as const;

function HashTab() {
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [useHmac, setUseHmac] = useState(false);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [upper, setUpper] = useState(false);

  const data = file ? file.bytes : utf8ToBytes(text);
  const rows = ALGOS.map(([name, fn]) => {
    const h = useHmac && key ? hmac(fn, utf8ToBytes(key), data) : fn(data);
    const hex = bytesToHex(h);
    return [name, upper ? hex.toUpperCase() : hex] as const;
  });

  return (
    <div className="grid grid--2">
      <Panel title="Input">
        {file ? (
          <div className="ed-file">
            <span>{file.name} <span className="muted">({file.bytes.length.toLocaleString()} bytes)</span></span>
            <button className="btn btn--sm" onClick={() => setFile(null)}>Hash text instead</button>
          </div>
        ) : (
          <TextArea code value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Text to hash" />
        )}
        <label className="btn btn--sm" style={{ alignSelf: "flex-start" }}>
          <FileUp size={14} /> Hash a file
          <input type="file" className="visually-hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setFile({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
            e.target.value = "";
          }} />
        </label>
        <Check label="HMAC with a secret key" checked={useHmac} onChange={setUseHmac} />
        {useHmac && <TextInput label="Secret key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />}
        <Check label="Uppercase hex" checked={upper} onChange={setUpper} />
      </Panel>
      <Panel title={useHmac && key ? "HMAC digests" : "Hashes"}>
        <ul className="hash-list">
          {rows.map(([name, hex]) => (
            <li key={name}>
              <span className="hash-list__name">{name}</span>
              <code>{hex}</code>
              <CopyButton text={hex} label="" />
            </li>
          ))}
        </ul>
        <p className="help">MD5 and SHA-1 are fine for checksums and cache keys, but not for passwords or security.</p>
      </Panel>
    </div>
  );
}

export function EncodeDecode() {
  const [tab, setTab] = useState<Tab>("base64");
  return (
    <ToolFrame slug="encode-decode">
      <Tabs value={tab} onChange={setTab} tabs={[["base64", "Base64"], ["url", "URL"], ["html", "HTML entities"], ["jwt", "JWT decoder"], ["hash", "Hash generator"]]} />
      {tab === "base64" && <Base64Tab />}
      {tab === "url" && <UrlTab />}
      {tab === "html" && <HtmlTab />}
      {tab === "jwt" && <JwtTab />}
      {tab === "hash" && <HashTab />}
      <p className="help" style={{ marginTop: 14 }}><ArrowDownUp size={13} style={{ verticalAlign: -2 }} /> Everything here runs locally — tokens and secrets never leave this tab.</p>
    </ToolFrame>
  );
}
