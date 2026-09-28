"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Square, Unlink } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Empty, Grid, Notice, Panel, Segmented, Select, Stat, downloadText } from "../ui";
import { normaliseUrl } from "@/lib/web";

interface LinkRow {
  url: string;
  status: number;
  ms: number;
  error?: string;
  finalUrl?: string;
  internal: boolean;
  broken: boolean;
  sources: { page: string; text: string; kind: string }[];
}

type Filter = "broken" | "redirected" | "all";

export function BrokenLinks() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"page" | "site">("site");
  const [maxPages, setMaxPages] = useState("25");
  const [external, setExternal] = useState(true);
  const [assets, setAssets] = useState(false);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [pages, setPages] = useState<{ url: string; status: number; error?: string }[]>([]);
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [summary, setSummary] = useState<{ capped: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("broken");
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    const u = normaliseUrl(url);
    if (!u) return;
    setRows([]); setPages([]); setError(null); setSummary(null); setState("running");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, mode, maxPages: +maxPages, maxLinks: mode === "site" ? 800 : 300, external, assets }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "The crawl couldn't start.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        const newRows: LinkRow[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "link") newRows.push(ev);
          else if (ev.type === "page") setPages((p) => [...p, ev]);
          else if (ev.type === "done") setSummary({ capped: ev.capped });
          else if (ev.type === "error") setError(ev.message);
        }
        if (newRows.length) setRows((r) => [...r, ...newRows]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "The crawl failed.");
    } finally {
      setState("done");
    }
  };

  const broken = rows.filter((r) => r.broken);
  const redirected = rows.filter((r) => !r.broken && r.finalUrl);
  const shown = filter === "broken" ? broken : filter === "redirected" ? redirected : rows;

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    broken.forEach((r) => m.set(r.status ? String(r.status) : "no response", (m.get(r.status ? String(r.status) : "no response") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [broken]);

  const csv = () => {
    const head = ["status", "url", "final_url", "internal", "found_on", "link_text", "error"];
    const data = shown.map((r) => [String(r.status || ""), r.url, r.finalUrl ?? "", r.internal ? "yes" : "no", r.sources.map((s) => s.page).join(" | "), r.sources[0]?.text ?? "", r.error ?? ""]);
    downloadText("broken-links.csv", [head, ...data].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  return (
    <ToolFrame slug="broken-links" wide>
      <Grid>
        <Panel title="Crawl">
          <form className="bp-url" onSubmit={(e) => { e.preventDefault(); if (state !== "running") start(); }}>
            <input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" aria-label="Start URL" />
            {state === "running" ? (
              <button type="button" className="btn" onClick={() => abort.current?.abort()}><Square size={14} /> Stop</button>
            ) : (
              <button className="btn btn--lantern" type="submit" disabled={!url.trim()}><Unlink size={15} /> Find broken links</button>
            )}
          </form>
          <Segmented label="Scope" value={mode} onChange={setMode} options={[["site", "Crawl the site"], ["page", "This page only"]]} />
          {mode === "site" && <Select label="Pages to crawl" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} options={["10", "25", "50", "100"]} hint="Follows internal links from the start page" />}
          <Check label="Check links to other websites" checked={external} onChange={setExternal} />
          <Check label="Also check images, scripts and stylesheets" checked={assets} onChange={setAssets} />
        </Panel>
        <Panel title={state === "running" ? "Crawling…" : state === "done" ? "Results" : "Summary"}>
          <div className="kvs">
            <Stat label="pages crawled" value={pages.length} />
            <Stat label="links checked" value={rows.length} />
            <Stat label="broken" value={broken.length} tone={broken.length ? "rem" : "add"} />
            <Stat label="redirected" value={redirected.length} tone="mod" />
          </div>
          {state === "running" && pages.length > 0 && <p className="help">Now on <code>{pages[pages.length - 1].url}</code></p>}
          {byStatus.length > 0 && <div className="filters">{byStatus.map(([s, n]) => <span key={s} className="chip tone-remove">{s}: {n}</span>)}</div>}
          {summary?.capped && <Notice tone="info">Stopped at the crawl limit. Raise “Pages to crawl” or start from a deeper page to cover more.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </Panel>
      </Grid>

      {rows.length === 0 && state !== "running" ? (
        <Panel><Empty icon={<Unlink size={28} />} title={state === "done" ? "No links found" : "Nothing crawled yet"}>{state === "done" ? "The page had no links to check, or it isn't HTML." : "Enter a site to find 404s, dead external links and redirect-heavy links, with the page each one appears on."}</Empty></Panel>
      ) : (
        <Panel
          title={`${shown.length} ${filter === "all" ? "links" : filter}`}
          actions={
            <>
              <div className="filters">
                {(["broken", "redirected", "all"] as Filter[]).map((f) => (
                  <button key={f} className={`filter${filter === f ? " filter--on" : ""}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)} <span>{f === "broken" ? broken.length : f === "redirected" ? redirected.length : rows.length}</span></button>
                ))}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={csv} disabled={!shown.length}><Download size={14} /> CSV</button>
            </>
          }
          pad={false}
        >
          <div className="tbl-wrap bl-table">
            <table className="tbl">
              <thead><tr><th>Status</th><th>Link</th><th>Found on</th></tr></thead>
              <tbody>
                {shown.slice(0, 1000).map((r) => (
                  <tr key={r.url}>
                    <td><span className={`chip ${r.broken ? "tone-remove" : r.finalUrl ? "tone-change" : "tone-add"}`}>{r.status || "ERR"}</span></td>
                    <td>
                      <div className="bl-link">
                      <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                      {r.sources[0]?.text && <span className="muted">“{r.sources[0].text}”{r.sources[0].kind !== "link" ? ` (${r.sources[0].kind})` : ""}</span>}
                      {r.finalUrl && <span className="t-mod">→ {r.finalUrl}</span>}
                      {r.error && <span className="t-rem">{r.error}</span>}
                      </div>
                    </td>
                    <td><div className="bl-src">{r.sources.map((s) => <a key={s.page} href={s.page} target="_blank" rel="noreferrer">{s.page.replace(/^https?:\/\/[^/]+/, "") || "/"}</a>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </ToolFrame>
  );
}
