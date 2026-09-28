"use client";

import { useState } from "react";
import { ArrowDown, Download, Route } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Notice, Panel, Segmented, TextArea, downloadText } from "../ui";
import { normaliseUrl } from "@/lib/web";

interface Hop { url: string; status: number; statusText: string; location: string | null; ms: number; headers: Record<string, string> }
interface Result { input: string; hops: Hop[]; loop: boolean; error?: string }

const statusTone = (s: number) => (s >= 200 && s < 300 ? "tone-add" : s === 301 || s === 308 ? "tone-move" : s >= 300 && s < 400 ? "tone-change" : "tone-remove");

function advice(r: Result): string[] {
  const out: string[] = [];
  const hops = r.hops;
  const redirects = hops.filter((h) => h.status >= 300 && h.status < 400);
  if (r.loop) out.push("Redirect loop — the chain comes back to a URL it already visited.");
  if (redirects.length > 1) out.push(`${redirects.length} redirects in a row. Point links and the old URL straight at the final address to save a round trip each time.`);
  if (redirects.some((h) => h.status === 302 || h.status === 307)) out.push("Uses a temporary redirect (302/307). Use 301 if the move is permanent so Google transfers ranking.");
  const first = hops[0], last = hops[hops.length - 1];
  if (first && last && first.url.startsWith("http://") && last.url.startsWith("http://")) out.push("Final page is still on http:// — no HTTPS redirect.");
  if (last && last.status >= 400) out.push(`Ends in an error (${last.status}).`);
  if (last?.headers["x-robots-tag"]?.includes("noindex")) out.push("Final page sends X-Robots-Tag: noindex.");
  return out;
}

export function RedirectChecker() {
  const [input, setInput] = useState("");
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const urls = [...new Set(input.split(/\n+/).map((s) => normaliseUrl(s)).filter(Boolean))].slice(0, 50);
    if (!urls.length) return;
    setBusy(true);
    setResults([]);
    for (let i = 0; i < urls.length; i += 4) {
      const batch = await Promise.all(urls.slice(i, i + 4).map(async (u) => {
        try {
          const r = await fetch(`/api/redirects?url=${encodeURIComponent(u)}&method=${method}`);
          const d = await r.json();
          if (!r.ok) return { input: u, hops: [], loop: false, error: d.error };
          return { input: u, hops: d.hops, loop: d.loop, error: d.error } as Result;
        } catch {
          return { input: u, hops: [], loop: false, error: "The Den's server didn't respond." };
        }
      }));
      setResults((r) => [...r, ...batch]);
    }
    setBusy(false);
  };

  const exportCsv = () => {
    const rows = [["start", "hops", "chain", "final_url", "final_status", "total_ms"]];
    for (const r of results) {
      const last = r.hops[r.hops.length - 1];
      rows.push([r.input, String(Math.max(0, r.hops.length - 1)), r.hops.map((h) => h.status).join(" > "), last?.url ?? "", String(last?.status ?? r.error ?? ""), String(r.hops.reduce((s, h) => s + h.ms, 0))]);
    }
    downloadText("redirect-check.csv", rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  return (
    <ToolFrame slug="redirect-checker">
      <Panel title="URLs to check" actions={<Segmented label="Method" value={method} onChange={setMethod} options={[["GET", "GET"], ["HEAD", "HEAD"]]} />}>
        <TextArea code rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"http://example.com\nexample.com/old-page\nhttps://www.example.com/shop"} />
        <div className="row" style={{ alignItems: "center" }}>
          <button className="btn btn--lantern" onClick={run} disabled={busy || !input.trim()}><Route size={15} /> {busy ? "Checking…" : "Check redirects"}</button>
          <span className="help">One URL per line, up to 50. Try the http://, www and non-www versions of a domain together.</span>
          {results.length > 1 && <button className="btn btn--ghost btn--sm" onClick={exportCsv}><Download size={14} /> CSV</button>}
        </div>
      </Panel>

      {results.length === 0 && !busy ? (
        <Panel><Empty icon={<Route size={28} />} title="Every hop, every status">See 301s, 302s, loops and slow hops between the first URL and where visitors end up.</Empty></Panel>
      ) : (
        results.map((r) => {
          const tips = advice(r);
          const total = r.hops.reduce((s, h) => s + h.ms, 0);
          const last = r.hops[r.hops.length - 1];
          return (
            <Panel key={r.input} title={<span className="rc-title">{r.input}</span>} actions={last && <span className="muted" style={{ fontSize: 13 }}>{r.hops.length - 1} redirect{r.hops.length === 2 ? "" : "s"}, {total} ms</span>}>
              {r.error && <Notice tone="error">{r.error}</Notice>}
              <ol className="chain">
                {r.hops.map((h, i) => (
                  <li key={i}>
                    <div className="chain__hop">
                      <span className={`chip ${statusTone(h.status)}`}>{h.status}</span>
                      <code className="chain__url">{h.url}</code>
                      <span className="muted chain__ms">{h.ms} ms</span>
                    </div>
                    {h.location && i < r.hops.length - 1 && <ArrowDown size={14} className="chain__arrow" />}
                  </li>
                ))}
              </ol>
              {tips.length > 0 ? <ul className="warn-list">{tips.map((t) => <li key={t}>{t}</li>)}</ul> : last && last.status < 300 && <p className="help t-add">Clean — {r.hops.length === 1 ? "no redirects" : "a single redirect"} to a {last.status} page.</p>}
              {last && (
                <details className="rc-headers">
                  <summary>Final response headers</summary>
                  <div className="tbl-wrap"><table className="tbl"><tbody>{Object.entries(last.headers).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td className="rc-hv">{v}</td></tr>)}</tbody></table></div>
                </details>
              )}
            </Panel>
          );
        })
      )}
    </ToolFrame>
  );
}
