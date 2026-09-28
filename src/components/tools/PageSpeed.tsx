"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Gauge, KeyRound, Play, Trash2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Grid, Notice, Panel, Segmented, TextInput, downloadText } from "../ui";
import { useStored, uid } from "@/lib/store";
import { normaliseUrl } from "@/lib/web";
import { useQueryParam } from "@/lib/handoff";

type Strategy = "mobile" | "desktop";

interface Run {
  id: string;
  url: string;
  site: string;
  strategy: Strategy;
  at: number;
  scores: { performance: number; accessibility: number; "best-practices": number; seo: number };
  metrics: { lcp?: number; cls?: number; tbt?: number; fcp?: number; si?: number; ttfb?: number };
  field?: { lcp?: string; inp?: string; cls?: string; overall?: string };
  opportunities: { title: string; savingsMs: number }[];
}

const CATS = ["performance", "accessibility", "best-practices", "seo"] as const;
const CAT_LABEL: Record<(typeof CATS)[number], string> = { performance: "Performance", accessibility: "Accessibility", "best-practices": "Best practices", seo: "SEO" };

const tone = (s: number) => (s >= 90 ? "add" : s >= 50 ? "mod" : "rem");

function Ring({ value, label }: { value: number; label: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className={`ring ring--${tone(value)}`}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} className="ring__track" />
        <circle cx="38" cy="38" r={r} className="ring__val" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
      </svg>
      <span className="ring__num">{value}</span>
      <span className="ring__label">{label}</span>
    </div>
  );
}

function Spark({ runs }: { runs: Run[] }) {
  const pts = [...runs].sort((a, b) => a.at - b.at).slice(-30);
  if (pts.length < 2) return null;
  const w = 260, h = 56;
  const x = (i: number) => (i / (pts.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 4 - (v / 100) * (h - 8);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.scores.performance).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label="Performance score over time">
      <line x1="0" x2={w} y1={y(90)} y2={y(90)} className="spark__good" />
      <path d={d} className="spark__line" />
      {pts.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.scores.performance)} r="2.5" className={`spark__dot spark__dot--${tone(p.scores.performance)}`}><title>{new Date(p.at).toLocaleDateString()}: {p.scores.performance}</title></circle>)}
    </svg>
  );
}

const fmtMs = (n?: number) => (n === undefined ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

export function PageSpeed() {
  const [key, setKey] = useStored("den.pagespeed.key", "");
  const [history, setHistory] = useStored<Run[]>("den.pagespeed.history", []);
  const [url, setUrl] = useState("");
  const [strategies, setStrategies] = useState<"mobile" | "desktop" | "both">("both");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const qUrl = useQueryParam("url");
  useEffect(() => { if (qUrl) setUrl(qUrl); }, [qUrl]);
  useEffect(() => { if (!key) setShowKey(true); }, [key]);

  const sites = useMemo(() => {
    const m = new Map<string, Run[]>();
    for (const r of history) m.set(r.site, [...(m.get(r.site) ?? []), r]);
    return [...m.entries()].sort((a, b) => Math.max(...b[1].map((r) => r.at)) - Math.max(...a[1].map((r) => r.at)));
  }, [history]);
  const current = site ?? sites[0]?.[0] ?? null;
  const runs = (sites.find(([s]) => s === current)?.[1] ?? []).sort((a, b) => b.at - a.at);

  const runOne = async (u: string, strategy: Strategy): Promise<Run> => {
    const q = new URLSearchParams({ url: u, strategy });
    CATS.forEach((c) => q.append("category", c));
    if (key) q.set("key", key);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
    const d = await res.json();
    if (!res.ok) {
      const msg: string = d?.error?.message ?? `PageSpeed returned ${res.status}.`;
      if (/quota|rate/i.test(msg)) throw new Error("Google's free quota is used up. Add an API key (free) to keep running tests.");
      throw new Error(msg.replace(/^Lighthouse returned error: /, ""));
    }
    const lh = d.lighthouseResult;
    const a = lh.audits;
    const le = d.loadingExperience?.metrics;
    const opp = Object.values(a as Record<string, { title: string; details?: { type?: string; overallSavingsMs?: number } }>)
      .filter((x) => x.details?.type === "opportunity" && (x.details.overallSavingsMs ?? 0) > 100)
      .sort((x, y) => (y.details!.overallSavingsMs ?? 0) - (x.details!.overallSavingsMs ?? 0))
      .slice(0, 6)
      .map((x) => ({ title: x.title, savingsMs: Math.round(x.details!.overallSavingsMs!) }));
    return {
      id: uid(), url: u, site: new URL(u).hostname.replace(/^www\./, ""), strategy, at: Date.now(),
      scores: Object.fromEntries(CATS.map((c) => [c, Math.round((lh.categories[c]?.score ?? 0) * 100)])) as Run["scores"],
      metrics: {
        lcp: a["largest-contentful-paint"]?.numericValue, cls: a["cumulative-layout-shift"]?.numericValue, tbt: a["total-blocking-time"]?.numericValue,
        fcp: a["first-contentful-paint"]?.numericValue, si: a["speed-index"]?.numericValue, ttfb: a["server-response-time"]?.numericValue,
      },
      field: le ? { lcp: le.LARGEST_CONTENTFUL_PAINT_MS?.category, inp: le.INTERACTION_TO_NEXT_PAINT?.category, cls: le.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category, overall: d.loadingExperience?.overall_category } : undefined,
      opportunities: opp,
    };
  };

  const run = async () => {
    const u = normaliseUrl(url);
    if (!u) return;
    setError(null);
    const list: Strategy[] = strategies === "both" ? ["mobile", "desktop"] : [strategies];
    try {
      for (const s of list) {
        setBusy(`Testing ${s}… this takes 20–40 seconds`);
        const r = await runOne(u, s);
        setHistory((h) => [r, ...h].slice(0, 1000));
        setSite(r.site);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The test failed.");
    } finally {
      setBusy(null);
    }
  };

  const latest = (s: Strategy) => runs.find((r) => r.strategy === s);
  const csv = () => {
    const head = ["date", "url", "strategy", ...CATS, "lcp_ms", "cls", "tbt_ms", "fcp_ms"];
    const rows = runs.map((r) => [new Date(r.at).toISOString(), r.url, r.strategy, ...CATS.map((c) => r.scores[c]), Math.round(r.metrics.lcp ?? 0), (r.metrics.cls ?? 0).toFixed(3), Math.round(r.metrics.tbt ?? 0), Math.round(r.metrics.fcp ?? 0)]);
    downloadText(`pagespeed-${current}.csv`, [head, ...rows].map((r) => r.join(",")).join("\n"), "text/csv");
  };

  return (
    <ToolFrame slug="pagespeed" wide>
      <div className="bp-bar">
        <form className="bp-url" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://client-site.com" aria-label="URL to test" />
          <button className="btn btn--lantern" type="submit" disabled={!!busy || !url.trim()}><Play size={15} /> {busy ? "Running…" : "Run test"}</button>
        </form>
        <Segmented label="Device" value={strategies} onChange={setStrategies} options={[["both", "Mobile + desktop"], ["mobile", "Mobile"], ["desktop", "Desktop"]]} />
        <button className="btn btn--ghost" onClick={() => setShowKey(!showKey)}><KeyRound size={15} /> API key</button>
      </div>
      {showKey && (
        <div style={{ marginBottom: 14 }}>
          <Panel>
            <TextInput label="PageSpeed Insights API key (optional)" type="password" value={key} onChange={(e) => setKey(e.target.value.trim())} autoComplete="off"
              hint={<>Without a key Google allows only a few tests. Get a free one at <a href="https://developers.google.com/speed/docs/insights/v5/get-started" target="_blank" rel="noreferrer">developers.google.com</a>. It&rsquo;s saved in this browser only.</>} />
          </Panel>
        </div>
      )}
      {busy && <div style={{ marginBottom: 14 }}><Notice tone="info">{busy}</Notice></div>}
      {error && <div style={{ marginBottom: 14 }}><Notice tone="error">{error}</Notice></div>}

      {sites.length === 0 ? (
        <Panel><Empty icon={<Gauge size={30} />} title="No tests yet">Run a site to start its score history. Every run is saved here so you can show clients how speed changed after your work.</Empty></Panel>
      ) : (
        <div className="ps-layout">
          <aside className="panel ps-sites">
            {sites.map(([s, list]) => {
              const last = [...list].sort((a, b) => b.at - a.at)[0];
              return (
                <button key={s} className={`ps-site${s === current ? " ps-site--on" : ""}`} onClick={() => setSite(s)}>
                  <span className="ps-site__name">{s}</span>
                  <span className={`ps-site__score t-${tone(last.scores.performance)}`}>{last.scores.performance}</span>
                  <span className="muted ps-site__meta">{list.length} run{list.length > 1 ? "s" : ""}, last {new Date(last.at).toLocaleDateString()}</span>
                </button>
              );
            })}
          </aside>
          <div className="stack">
            <Grid>
              {(["mobile", "desktop"] as Strategy[]).map((s) => {
                const r = latest(s);
                return (
                  <Panel key={s} title={`${s === "mobile" ? "Mobile" : "Desktop"}${r ? `, ${new Date(r.at).toLocaleString()}` : ""}`}>
                    {r ? (
                      <>
                        <div className="rings">{CATS.map((c) => <Ring key={c} value={r.scores[c]} label={CAT_LABEL[c]} />)}</div>
                        <div className="vitals">
                          <div><span>LCP</span><strong className={`t-${(r.metrics.lcp ?? 0) <= 2500 ? "add" : (r.metrics.lcp ?? 0) <= 4000 ? "mod" : "rem"}`}>{fmtMs(r.metrics.lcp)}</strong></div>
                          <div><span>CLS</span><strong className={`t-${(r.metrics.cls ?? 0) <= 0.1 ? "add" : (r.metrics.cls ?? 0) <= 0.25 ? "mod" : "rem"}`}>{r.metrics.cls?.toFixed(3) ?? "—"}</strong></div>
                          <div><span>TBT</span><strong className={`t-${(r.metrics.tbt ?? 0) <= 200 ? "add" : (r.metrics.tbt ?? 0) <= 600 ? "mod" : "rem"}`}>{fmtMs(r.metrics.tbt)}</strong></div>
                          <div><span>FCP</span><strong>{fmtMs(r.metrics.fcp)}</strong></div>
                          <div><span>Speed index</span><strong>{fmtMs(r.metrics.si)}</strong></div>
                          <div><span>Server</span><strong>{fmtMs(r.metrics.ttfb)}</strong></div>
                        </div>
                        {r.field?.overall && <p className="help">Real-user data (Chrome UX report): overall <strong>{r.field.overall.toLowerCase()}</strong>{r.field.inp ? `, INP ${r.field.inp.toLowerCase()}` : ""}.</p>}
                        {r.opportunities.length > 0 && (
                          <ul className="opps">{r.opportunities.map((o) => <li key={o.title}><span>{o.title}</span><span className="t-mod">−{fmtMs(o.savingsMs)}</span></li>)}</ul>
                        )}
                      </>
                    ) : (
                      <p className="help">No {s} run yet for {current}.</p>
                    )}
                  </Panel>
                );
              })}
            </Grid>
            <Panel
              title={`History for ${current}`}
              actions={
                <>
                  <button className="btn btn--ghost btn--sm" onClick={csv}><Download size={14} /> CSV</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => { if (confirm(`Delete all saved runs for ${current}?`)) { setHistory(history.filter((r) => r.site !== current)); setSite(null); } }}><Trash2 size={14} /> Delete site</button>
                </>
              }
            >
              <div className="row" style={{ alignItems: "center", gap: 28 }}>
                <div className="ps-spark"><span className="fld__label">Mobile performance</span><Spark runs={runs.filter((r) => r.strategy === "mobile")} /></div>
                <div className="ps-spark"><span className="fld__label">Desktop performance</span><Spark runs={runs.filter((r) => r.strategy === "desktop")} /></div>
              </div>
              <div className="tbl-wrap ps-table">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Device</th><th>URL</th>{CATS.map((c) => <th key={c} className="num">{CAT_LABEL[c]}</th>)}<th className="num">LCP</th><th className="num">CLS</th><th /></tr></thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.at).toLocaleString()}</td>
                        <td>{r.strategy}</td>
                        <td className="muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</td>
                        {CATS.map((c) => <td key={c} className={`num t-${tone(r.scores[c])}`}>{r.scores[c]}</td>)}
                        <td className="num">{fmtMs(r.metrics.lcp)}</td>
                        <td className="num">{r.metrics.cls?.toFixed(2)}</td>
                        <td><button className="btn btn--ghost btn--sm" aria-label="Delete run" onClick={() => setHistory(history.filter((x) => x.id !== r.id))}><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </ToolFrame>
  );
}
