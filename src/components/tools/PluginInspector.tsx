"use client";

import { useMemo, useState } from "react";
import { PackageSearch, ShieldAlert, ShieldCheck, TriangleAlert, FileArchive } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, FileDrop, Notice, Panel, Stat } from "../ui";
import { inspectZip, type InspectReport, type Severity, type Finding } from "@/lib/inspector";
import { formatBytes } from "../theme-diff/DropSlab";

const KIND: Record<InspectReport["kind"], string> = {
  plugin: "WordPress plugin", theme: "WordPress theme", "child-theme": "Child theme", "block-theme": "Block theme",
  "shopify-theme": "Shopify theme", unknown: "Unknown package",
};

const SEV_LABEL: Record<Severity, string> = { high: "High risk", medium: "Review", low: "Low", info: "Info" };
const SEV_TONE: Record<Severity, string> = { high: "tone-remove", medium: "tone-change", low: "tone-info", info: "tone-info" };

export function PluginInspector() {
  const [report, setReport] = useState<InspectReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sev, setSev] = useState<Severity | "all">("all");

  const run = async (f: File) => {
    setError(null);
    setReport(null);
    setFileName(f.name);
    setBusy(0);
    try {
      const r = await inspectZip(await f.arrayBuffer(), (d, t) => setBusy(Math.round((d / Math.max(1, t)) * 100)));
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that ZIP.");
    } finally {
      setBusy(null);
    }
  };

  const groups = useMemo(() => {
    if (!report) return [];
    const m = new Map<string, Finding[]>();
    for (const f of report.findings) {
      if (sev !== "all" && f.rule.severity !== sev) continue;
      m.set(f.rule.id, [...(m.get(f.rule.id) ?? []), f]);
    }
    return [...m.values()];
  }, [report, sev]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
    report?.findings.forEach((f) => c[f.rule.severity]++);
    return c;
  }, [report]);

  const h = report?.headers ?? {};
  const rows: [string, string | undefined][] = report
    ? [
        ["Version", h.Version], ["Requires WordPress", h["Requires at least"] ?? report.readme["Requires at least"]],
        ["Tested up to", h["Tested up to"] ?? report.readme["Tested up to"]], ["Requires PHP", h["Requires PHP"] ?? report.readme["Requires PHP"]],
        ["Parent theme", h.Template], ["WooCommerce tested", h["WC tested up to"]], ["Author", h.Author], ["Author URI", h["Author URI"] ?? h["Plugin URI"] ?? h["Theme URI"]],
        ["Text domain", h["Text Domain"]], ["License", h.License], ["Requires plugins", h["Requires Plugins"]], ["Update URI", h["Update URI"]],
        ["Main file", report.mainFile ?? undefined],
      ]
    : [];

  return (
    <ToolFrame slug="plugin-inspector">
      <FileDrop accept=".zip" label={busy !== null ? `Scanning ${fileName}… ${busy}%` : "Drop a plugin or theme ZIP"} hint="Nothing is uploaded — the ZIP is unpacked and scanned in this tab." icon={<FileArchive size={26} />} onFiles={([f]) => run(f)} />
      {error && <div style={{ marginTop: 14 }}><Notice tone="error">{error}</Notice></div>}

      {!report && busy === null && !error && (
        <p className="help" style={{ marginTop: 14 }}>
          Checks for {`eval`}, encoded payloads, shell commands, hidden admin accounts, nulled-plugin markers, unescaped input and more. It&rsquo;s a fast heuristic scan — a clean result isn&rsquo;t a guarantee, but anything flagged high deserves a look before it goes on a client site.
        </p>
      )}

      {report && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className={`verdict verdict--${counts.high ? "bad" : counts.medium ? "warn" : "ok"}`}>
            {counts.high ? <ShieldAlert size={28} /> : counts.medium ? <TriangleAlert size={28} /> : <ShieldCheck size={28} />}
            <div>
              <strong>
                {counts.high
                  ? `${counts.high} high-risk finding${counts.high > 1 ? "s" : ""} — review before installing`
                  : counts.medium
                    ? `No high-risk code. ${counts.medium} thing${counts.medium > 1 ? "s" : ""} worth reviewing`
                    : "No risky patterns found"}
              </strong>
              <span>{KIND[report.kind]}: {report.name}{h.Version ? ` ${h.Version}` : ""}</span>
            </div>
          </div>

          <div className="grid grid--2">
            <Panel title="Header">
              {h.Description && <p className="help" style={{ color: "var(--ash)" }}>{h.Description}</p>}
              <dl className="dl">
                {rows.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </Panel>
            <div className="stack">
              <Panel title="Package">
                <div className="kvs">
                  <Stat label="files" value={report.stats.files.toLocaleString()} />
                  <Stat label="PHP files" value={report.stats.php.toLocaleString()} />
                  <Stat label="JS / CSS" value={`${report.stats.js} / ${report.stats.css}`} />
                  <Stat label="lines" value={report.stats.lines.toLocaleString()} />
                  <Stat label="unpacked" value={formatBytes(report.stats.bytes)} />
                </div>
                {report.stats.vendor.length > 0 && (
                  <p className="help">Bundled libraries: {report.stats.vendor.map((v) => <code key={v} style={{ marginRight: 8 }}>{v}</code>)}</p>
                )}
              </Panel>
              {(report.readme["Stable tag"] || report.readme.changelogTop) && (
                <Panel title="readme.txt">
                  <dl className="dl">
                    {["Stable tag", "Tested up to", "Requires PHP", "Contributors"].map((k) => report.readme[k] && <div key={k}><dt>{k}</dt><dd>{report.readme[k]}</dd></div>)}
                  </dl>
                  {report.readme.changelogTop && <pre className="out__pre" style={{ maxHeight: 180, whiteSpace: "pre-wrap" }}>{report.readme.changelogTop}</pre>}
                </Panel>
              )}
            </div>
          </div>

          {report.warnings.length > 0 && (
            <Panel title="Housekeeping">
              <ul className="warn-list">{report.warnings.map((w) => <li key={w}><TriangleAlert size={14} /> {w}</li>)}</ul>
            </Panel>
          )}

          <Panel
            title={`Code scan (${report.findings.length} finding${report.findings.length === 1 ? "" : "s"})`}
            actions={
              <div className="filters">
                {(["all", "high", "medium", "low"] as const).map((s) => (
                  <button key={s} className={`filter${sev === s ? " filter--on" : ""}`} onClick={() => setSev(s)}>
                    {s === "all" ? "All" : SEV_LABEL[s]} <span>{s === "all" ? report.findings.length : counts[s]}</span>
                  </button>
                ))}
              </div>
            }
          >
            {groups.length === 0 ? (
              <Empty icon={<PackageSearch size={28} />} title={report.findings.length ? "Nothing at this level" : "Clean scan"}>
                {report.findings.length ? "Pick another severity above." : "None of the risky patterns appeared in this package."}
              </Empty>
            ) : (
              groups.map((list) => {
                const r = list[0].rule;
                return (
                  <details key={r.id} className="finding" open={r.severity === "high"}>
                    <summary>
                      <span className={`chip ${SEV_TONE[r.severity]}`}>{SEV_LABEL[r.severity]}</span>
                      <strong>{r.title}</strong>
                      <span className="muted">{list.length} place{list.length > 1 ? "s" : ""}</span>
                    </summary>
                    <p className="finding__why">{r.why}</p>
                    <ul className="finding__list">
                      {list.slice(0, 50).map((f, i) => (
                        <li key={i}>
                          <code className="finding__loc">{f.path}:{f.line}</code>
                          <code className="finding__code">{f.snippet}</code>
                        </li>
                      ))}
                      {list.length > 50 && <li className="muted">…and {list.length - 50} more</li>}
                    </ul>
                  </details>
                );
              })
            )}
          </Panel>

          {report.missingAbspath.length > 0 && (
            <details className="finding">
              <summary>
                <span className="chip tone-info">Hardening</span>
                <strong>{report.missingAbspath.length} PHP file{report.missingAbspath.length > 1 ? "s" : ""} can be loaded directly</strong>
              </summary>
              <p className="finding__why">These files run code without checking <code>defined( &apos;ABSPATH&apos; )</code>, so visiting their URL executes them outside WordPress. Usually harmless, but a missing guard is a common plugin-review note.</p>
              <ul className="finding__list">{report.missingAbspath.slice(0, 60).map((p) => <li key={p}><code className="finding__loc">{p}</code></li>)}</ul>
            </details>
          )}
        </div>
      )}
    </ToolFrame>
  );
}
