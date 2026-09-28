"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Download, History, Plus, Printer, Save, Trash2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Notice, Panel, Select, TextArea, TextInput, downloadText } from "../ui";
import { CopyButton } from "../CopyButton";
import { useStored, uid, getStored } from "@/lib/store";
import { useQueryParam } from "@/lib/handoff";
import { useProjects, primaryUrl } from "./Projects";

interface Update { name: string; kind: "Plugin" | "Theme" | "Core" | "Other"; from: string; to: string }

interface ReportData {
  id: string;
  projectId: string;
  client: string;
  site: string;
  period: string;
  performedOn: string;
  preparedBy: string;
  accent: string;
  updates: Update[];
  backups: { enabled: boolean; count: string; last: string; tool: string; location: string };
  uptime: { enabled: boolean; percent: string; incidents: string; tool: string };
  security: { enabled: boolean; scan: string; blocked: string; notes: string };
  performance: { enabled: boolean; mobile: string; desktop: string; prevMobile: string; notes: string };
  work: string;
  next: string;
  hours: string;
  savedAt?: number;
}

const month = () => new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const blank = (): ReportData => ({
  id: uid(), projectId: "", client: "", site: "", period: month(), performedOn: new Date().toISOString().slice(0, 10), preparedBy: "Thavisha", accent: "#ff8a3d",
  updates: [],
  backups: { enabled: true, count: "30", last: new Date().toISOString().slice(0, 10), tool: "UpdraftPlus", location: "Google Drive" },
  uptime: { enabled: true, percent: "99.98", incidents: "0", tool: "UptimeRobot" },
  security: { enabled: true, scan: "Clean", blocked: "", notes: "" },
  performance: { enabled: false, mobile: "", desktop: "", prevMobile: "", notes: "" },
  work: "", next: "", hours: "",
});

/** Parses lines like "WooCommerce 9.2.3 → 9.3.1", "Elementor: 3.24 to 3.25" or WP's update-core list. */
export function parseUpdates(text: string): Update[] {
  const out: Update[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^[-*•\d.)\s]+/, "");
    if (!line) continue;
    const m = line.match(/^(.*?)[\s:–-]+(?:v(?:ersion)?\.?\s*)?(\d[\w.-]*)\s*(?:→|->|=>|to|»|–|-)\s*(?:v(?:ersion)?\.?\s*)?(\d[\w.-]*)/i)
      ?? line.match(/^(.*?)\s+You have version (\d[\w.-]*) installed\.\s*Update to (\d[\w.-]*)/i);
    if (m) {
      const name = m[1].replace(/[\s:–-]+$/, "").trim();
      const kind: Update["kind"] = /^wordpress( core)?$/i.test(name) ? "Core" : /theme/i.test(name) ? "Theme" : "Plugin";
      out.push({ name, kind, from: m[2], to: m[3] });
    } else {
      out.push({ name: line, kind: "Plugin", from: "", to: "" });
    }
  }
  return out;
}

function ReportDoc({ r }: { r: ReportData }) {
  const byKind = (k: Update["kind"]) => r.updates.filter((u) => u.kind === k);
  const improvement = r.performance.prevMobile && r.performance.mobile ? Number(r.performance.mobile) - Number(r.performance.prevMobile) : null;
  return (
    <article className="mr-doc" style={{ ["--accent" as string]: r.accent }}>
      <header className="mr-doc__head">
        <div>
          <p className="mr-doc__kicker">Website care report</p>
          <h1>{r.site || "Your website"}</h1>
          <p className="mr-doc__meta">{r.period}{r.client ? ` for ${r.client}` : ""}</p>
        </div>
        <div className="mr-doc__by">Prepared by {r.preparedBy || "—"}<br />{r.performedOn && new Date(r.performedOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
      </header>

      <section className="mr-doc__tiles">
        <div><strong>{r.updates.length}</strong><span>updates installed</span></div>
        {r.backups.enabled && <div><strong>{r.backups.count || "—"}</strong><span>backups taken</span></div>}
        {r.uptime.enabled && <div><strong>{r.uptime.percent ? `${r.uptime.percent}%` : "—"}</strong><span>uptime</span></div>}
        {r.security.enabled && <div><strong>{r.security.scan || "—"}</strong><span>security scan</span></div>}
        {r.performance.enabled && r.performance.mobile && <div><strong>{r.performance.mobile}</strong><span>mobile speed score{improvement ? ` (${improvement > 0 ? "+" : ""}${improvement})` : ""}</span></div>}
      </section>

      {r.updates.length > 0 && (
        <section>
          <h2>Updates</h2>
          <table>
            <thead><tr><th>Item</th><th>Type</th><th>From</th><th>To</th></tr></thead>
            <tbody>
              {(["Core", "Theme", "Plugin", "Other"] as const).flatMap((k) => byKind(k)).map((u, i) => (
                <tr key={i}><td>{u.name}</td><td>{u.kind}</td><td>{u.from || "—"}</td><td>{u.to || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.backups.enabled && (
        <section>
          <h2>Backups</h2>
          <p>{r.backups.count || "Regular"} backups were taken this period{r.backups.tool ? ` with ${r.backups.tool}` : ""}{r.backups.location ? ` and stored off-site in ${r.backups.location}` : ""}. The latest backup is from {r.backups.last ? new Date(r.backups.last).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "this month"}, so the site can be restored quickly if anything goes wrong.</p>
        </section>
      )}

      {r.uptime.enabled && (
        <section>
          <h2>Uptime</h2>
          <p>The site was online {r.uptime.percent || "—"}% of the time{r.uptime.tool ? `, monitored by ${r.uptime.tool}` : ""}. {Number(r.uptime.incidents) > 0 ? `There ${Number(r.uptime.incidents) === 1 ? "was 1 outage" : `were ${r.uptime.incidents} outages`} this period.` : "There were no outages."}</p>
        </section>
      )}

      {r.security.enabled && (
        <section>
          <h2>Security</h2>
          <p>Malware scan result: <strong>{r.security.scan || "—"}</strong>.{r.security.blocked ? ` ${r.security.blocked} malicious login attempts or requests were blocked.` : ""}{r.security.notes ? ` ${r.security.notes}` : ""}</p>
        </section>
      )}

      {r.performance.enabled && (
        <section>
          <h2>Performance</h2>
          <p>Google PageSpeed scores: mobile <strong>{r.performance.mobile || "—"}</strong>, desktop <strong>{r.performance.desktop || "—"}</strong>{r.performance.prevMobile ? ` (mobile was ${r.performance.prevMobile} last period)` : ""}.{r.performance.notes ? ` ${r.performance.notes}` : ""}</p>
        </section>
      )}

      {r.work.trim() && (
        <section>
          <h2>Other work this period</h2>
          <ul>{r.work.split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l.replace(/^[-*•]\s*/, "")}</li>)}</ul>
        </section>
      )}

      {r.next.trim() && (
        <section>
          <h2>Recommendations</h2>
          <ul>{r.next.split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l.replace(/^[-*•]\s*/, "")}</li>)}</ul>
        </section>
      )}

      {r.hours && <p className="mr-doc__foot">Time spent: {r.hours} hour{r.hours === "1" ? "" : "s"}.</p>}
    </article>
  );
}

function asText(r: ReportData): string {
  const L: string[] = [];
  L.push(`Website care report: ${r.site} (${r.period})`, "");
  L.push(`Updates installed: ${r.updates.length}`);
  r.updates.forEach((u) => L.push(`  - ${u.name}${u.from ? ` ${u.from} → ${u.to}` : ""}`));
  if (r.backups.enabled) L.push("", `Backups: ${r.backups.count} taken${r.backups.tool ? ` with ${r.backups.tool}` : ""}, latest ${r.backups.last}${r.backups.location ? `, stored in ${r.backups.location}` : ""}.`);
  if (r.uptime.enabled) L.push(`Uptime: ${r.uptime.percent}%${Number(r.uptime.incidents) ? `, ${r.uptime.incidents} outage(s)` : ", no outages"}.`);
  if (r.security.enabled) L.push(`Security scan: ${r.security.scan}${r.security.blocked ? `, ${r.security.blocked} attacks blocked` : ""}.`);
  if (r.performance.enabled) L.push(`PageSpeed: mobile ${r.performance.mobile}, desktop ${r.performance.desktop}.`);
  if (r.work.trim()) L.push("", "Other work:", ...r.work.split("\n").filter(Boolean).map((l) => `  - ${l.replace(/^[-*•]\s*/, "")}`));
  if (r.next.trim()) L.push("", "Recommendations:", ...r.next.split("\n").filter(Boolean).map((l) => `  - ${l.replace(/^[-*•]\s*/, "")}`));
  L.push("", `— ${r.preparedBy}`);
  return L.join("\n");
}

export function MaintenanceReport() {
  const [projects] = useProjects();
  const [saved, setSaved] = useStored<ReportData[]>("den.maintenance.reports", []);
  const [r, setR] = useState<ReportData>(blank);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const projectParam = useQueryParam("project");
  const set = (p: Partial<ReportData>) => setR((x) => ({ ...x, ...p }));

  const pickProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) { set({ projectId: "" }); return; }
    const url = primaryUrl(p);
    // pull the latest PageSpeed scores for this site, if any
    const host = (() => { try { return new URL(/^https?:/.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    const runs = getStored<{ site: string; strategy: string; at: number; scores: { performance: number } }[]>("den.pagespeed.history", []).filter((x) => x.site === host).sort((a, b) => b.at - a.at);
    const m = runs.find((x) => x.strategy === "mobile"), d = runs.find((x) => x.strategy === "desktop");
    const prev = runs.filter((x) => x.strategy === "mobile")[1];
    const last = saved.filter((x) => x.projectId === id).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0];
    setR((x) => ({
      ...x, projectId: id, client: p.client, site: p.site || host,
      ...(last ? { backups: last.backups, uptime: { ...last.uptime }, security: { ...last.security, blocked: "", notes: "" }, accent: last.accent } : {}),
      performance: m ? { enabled: true, mobile: String(m.scores.performance), desktop: d ? String(d.scores.performance) : "", prevMobile: prev ? String(prev.scores.performance) : "", notes: "" } : x.performance,
    }));
  };

  useEffect(() => {
    if (projectParam && projects.some((p) => p.id === projectParam)) pickProject(projectParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectParam, projects.length]);

  const history = useMemo(() => [...saved].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)), [saved]);

  const save = () => {
    const withTime = { ...r, savedAt: Date.now() };
    setSaved([withTime, ...saved.filter((x) => x.id !== r.id)]);
    setMsg("Saved to report history.");
    setTimeout(() => setMsg(null), 2500);
  };

  const htmlFile = () => {
    const el = document.querySelector(".mr-doc");
    const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((c) => c.cssText).filter((t) => t.includes(".mr-doc")); } catch { return []; } }).join("\n");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${r.site} — ${r.period} care report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f4f4f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif}${css}</style></head><body>${el?.outerHTML ?? ""}</body></html>`;
    downloadText(`${(r.site || "site").replace(/\W+/g, "-")}-${r.period.replace(/\s+/g, "-")}-report.html`, html, "text/html");
  };

  return (
    <ToolFrame slug="maintenance-report" wide>
      <div className="mr-layout">
        <div className="stack mr-form">
          <Panel title="Client">
            {projects.length > 0 ? (
              <Select label="Project" value={r.projectId} onChange={(e) => pickProject(e.target.value)} options={[["", "Choose a project…"], ...projects.map((p) => [p.id, `${p.site || p.client}${p.client && p.site ? ` (${p.client})` : ""}`] as [string, string])]} hint="Fills in the site, last month's settings and the latest PageSpeed scores" />
            ) : (
              <p className="help">Add clients in the Project Dashboard to fill these in automatically.</p>
            )}
            <div className="row">
              <TextInput label="Website" value={r.site} onChange={(e) => set({ site: e.target.value })} placeholder="fragrancevault.lk" />
              <TextInput label="Client" value={r.client} onChange={(e) => set({ client: e.target.value })} />
            </div>
            <div className="row">
              <TextInput label="Period" value={r.period} onChange={(e) => set({ period: e.target.value })} />
              <TextInput label="Date" type="date" value={r.performedOn} onChange={(e) => set({ performedOn: e.target.value })} />
            </div>
            <div className="row">
              <TextInput label="Prepared by" value={r.preparedBy} onChange={(e) => set({ preparedBy: e.target.value })} />
              <div className="fld"><span className="fld__label">Accent colour</span><div className="colorfield"><input type="color" value={r.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Accent colour" /><input className="inp inp--code" value={r.accent} onChange={(e) => set({ accent: e.target.value })} /></div></div>
            </div>
          </Panel>

          <Panel title={`Updates (${r.updates.length})`}>
            <TextArea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Paste updates, one per line:\nWooCommerce 9.2.3 → 9.3.1\nElementor 3.24.0 to 3.25.2\nWordPress 6.6.2 → 6.7"} code />
            <div className="row">
              <button className="btn" disabled={!paste.trim()} onClick={() => { set({ updates: [...r.updates, ...parseUpdates(paste)] }); setPaste(""); }}><Plus size={14} /> Add to report</button>
              <button className="btn btn--ghost" onClick={() => set({ updates: [...r.updates, { name: "", kind: "Plugin", from: "", to: "" }] })}>Add a row</button>
            </div>
            {r.updates.map((u, i) => (
              <div className="mr-upd" key={i}>
                <input className="inp" value={u.name} placeholder="Name" aria-label="Name" onChange={(e) => set({ updates: r.updates.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <select className="inp" value={u.kind} aria-label="Type" onChange={(e) => set({ updates: r.updates.map((x, j) => (j === i ? { ...x, kind: e.target.value as Update["kind"] } : x)) })}>
                  {["Plugin", "Theme", "Core", "Other"].map((k) => <option key={k}>{k}</option>)}
                </select>
                <input className="inp" value={u.from} placeholder="From" aria-label="From version" onChange={(e) => set({ updates: r.updates.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} />
                <input className="inp" value={u.to} placeholder="To" aria-label="To version" onChange={(e) => set({ updates: r.updates.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} />
                <button className="btn btn--ghost btn--sm" aria-label="Remove" onClick={() => set({ updates: r.updates.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </Panel>

          <Panel title="Backups, uptime & security">
            <Check label="Backups" checked={r.backups.enabled} onChange={(v) => set({ backups: { ...r.backups, enabled: v } })} />
            {r.backups.enabled && (
              <div className="row">
                <TextInput label="Backups taken" value={r.backups.count} onChange={(e) => set({ backups: { ...r.backups, count: e.target.value } })} />
                <TextInput label="Latest" type="date" value={r.backups.last} onChange={(e) => set({ backups: { ...r.backups, last: e.target.value } })} />
                <TextInput label="Tool" value={r.backups.tool} onChange={(e) => set({ backups: { ...r.backups, tool: e.target.value } })} />
                <TextInput label="Stored in" value={r.backups.location} onChange={(e) => set({ backups: { ...r.backups, location: e.target.value } })} />
              </div>
            )}
            <Check label="Uptime" checked={r.uptime.enabled} onChange={(v) => set({ uptime: { ...r.uptime, enabled: v } })} />
            {r.uptime.enabled && (
              <div className="row">
                <TextInput label="Uptime %" value={r.uptime.percent} onChange={(e) => set({ uptime: { ...r.uptime, percent: e.target.value } })} />
                <TextInput label="Outages" value={r.uptime.incidents} onChange={(e) => set({ uptime: { ...r.uptime, incidents: e.target.value } })} />
                <TextInput label="Monitor" value={r.uptime.tool} onChange={(e) => set({ uptime: { ...r.uptime, tool: e.target.value } })} />
              </div>
            )}
            <Check label="Security" checked={r.security.enabled} onChange={(v) => set({ security: { ...r.security, enabled: v } })} />
            {r.security.enabled && (
              <>
                <div className="row">
                  <Select label="Scan result" value={r.security.scan} onChange={(e) => set({ security: { ...r.security, scan: e.target.value } })} options={["Clean", "Issues fixed", "Needs attention"]} />
                  <TextInput label="Attacks blocked" value={r.security.blocked} onChange={(e) => set({ security: { ...r.security, blocked: e.target.value } })} placeholder="e.g. 1,284" />
                </div>
                <TextInput label="Security notes" value={r.security.notes} onChange={(e) => set({ security: { ...r.security, notes: e.target.value } })} />
              </>
            )}
            <Check label="Performance" checked={r.performance.enabled} onChange={(v) => set({ performance: { ...r.performance, enabled: v } })} />
            {r.performance.enabled && (
              <div className="row">
                <TextInput label="Mobile score" value={r.performance.mobile} onChange={(e) => set({ performance: { ...r.performance, mobile: e.target.value } })} />
                <TextInput label="Desktop score" value={r.performance.desktop} onChange={(e) => set({ performance: { ...r.performance, desktop: e.target.value } })} />
                <TextInput label="Mobile last time" value={r.performance.prevMobile} onChange={(e) => set({ performance: { ...r.performance, prevMobile: e.target.value } })} />
              </div>
            )}
          </Panel>

          <Panel title="Work & recommendations">
            <TextArea label="Other work this period" hint="One item per line" rows={4} value={r.work} onChange={(e) => set({ work: e.target.value })} placeholder={"Fixed checkout button on mobile\nAdded new banner to the homepage"} />
            <TextArea label="Recommendations" hint="One per line" rows={3} value={r.next} onChange={(e) => set({ next: e.target.value })} placeholder="Upgrade PHP from 8.1 to 8.3 (host setting)" />
            <TextInput label="Hours spent" value={r.hours} onChange={(e) => set({ hours: e.target.value })} style={{ maxWidth: 140 }} />
          </Panel>

          {history.length > 0 && (
            <Panel title={<><History size={15} style={{ verticalAlign: -2 }} /> Past reports</>}>
              <ul className="rx-saved">
                {history.slice(0, 20).map((h) => (
                  <li key={h.id}>
                    <button className="rx-saved__load" onClick={() => setR(h)}><strong>{h.site}, {h.period}</strong><code>{h.updates.length} updates</code></button>
                    <button className="btn btn--ghost btn--sm" title="Start next month from this one" onClick={() => setR({ ...h, id: uid(), period: month(), performedOn: new Date().toISOString().slice(0, 10), updates: [], work: "", next: h.next, savedAt: undefined })}>Duplicate</button>
                    <button className="btn btn--ghost btn--sm" aria-label="Delete" onClick={() => setSaved(saved.filter((x) => x.id !== h.id))}><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="mr-preview">
          <div className="mr-toolbar">
            <button className="btn btn--lantern" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</button>
            <button className="btn" onClick={htmlFile}><Download size={15} /> HTML file</button>
            <CopyButton text={asText(r)} label="Copy as email text" />
            <button className="btn btn--ghost" onClick={save}><Save size={15} /> Save</button>
            <button className="btn btn--ghost" onClick={() => setR(blank())}><ClipboardCheck size={15} /> New</button>
          </div>
          {msg && <Notice tone="ok">{msg}</Notice>}
          <ReportDoc r={r} />
        </div>
      </div>
    </ToolFrame>
  );
}

