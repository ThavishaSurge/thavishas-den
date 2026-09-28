"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, ExternalLink, FolderKanban, Gauge, Plus, Search, ShieldCheck, Trash2, Download, Upload, MonitorSmartphone } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Notice, Panel, Select, TextArea, TextInput, downloadText } from "../ui";
import { useStored, uid } from "@/lib/store";

export interface Project {
  id: string;
  client: string;
  site: string;
  status: "active" | "care" | "paused" | "done";
  urls: { label: string; url: string }[];
  stack: { platform: string; builder: string; theme: string; hosting: string; dns: string; php: string; plugins: string };
  contact: { name: string; email: string; phone: string };
  order: string;
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export const STATUS: Record<Project["status"], { label: string; tone: string }> = {
  active: { label: "In progress", tone: "tone-change" },
  care: { label: "Care plan", tone: "tone-add" },
  paused: { label: "Paused", tone: "tone-info" },
  done: { label: "Delivered", tone: "tone-move" },
};

export function useProjects() {
  return useStored<Project[]>("den.projects", []);
}

const blank = (): Project => ({
  id: uid(), client: "", site: "", status: "active",
  urls: [{ label: "Live site", url: "" }, { label: "wp-admin", url: "" }, { label: "Staging", url: "" }],
  stack: { platform: "WordPress", builder: "Elementor", theme: "", hosting: "", dns: "", php: "", plugins: "" },
  contact: { name: "", email: "", phone: "" }, order: "", tags: [], notes: "", createdAt: Date.now(), updatedAt: Date.now(),
});

export function primaryUrl(p: Project): string {
  return p.urls.find((u) => u.url && !/admin|login|cpanel|hosting/i.test(u.label))?.url ?? p.urls.find((u) => u.url)?.url ?? "";
}

export function Projects() {
  const [projects, setProjects] = useProjects();
  // remember the open project so coming back from a tool lands in the same place
  const [activeId, setActiveId] = useStored<string | null>("den.projects.open", null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Project["status"] | "all">("all");

  const list = useMemo(() => {
    const n = q.toLowerCase();
    return projects
      .filter((p) => (status === "all" || p.status === status) && (!n || JSON.stringify(p).toLowerCase().includes(n)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects, q, status]);
  const p = projects.find((x) => x.id === activeId) ?? null;

  const update = (patch: Partial<Project>) => p && setProjects(projects.map((x) => (x.id === p.id ? { ...x, ...patch, updatedAt: Date.now() } : x)));
  const create = () => { const n = blank(); setProjects([n, ...projects]); setActiveId(n.id); };
  const counts = (s: Project["status"]) => projects.filter((x) => x.status === s).length;
  const live = p ? primaryUrl(p) : "";
  const enc = encodeURIComponent(live);

  return (
    <ToolFrame slug="projects" wide>
      {projects.length > 0 && (
        <div className="pj-summary">
          {(Object.keys(STATUS) as Project["status"][]).map((s) => (
            <button key={s} className={`pj-stat${status === s ? " pj-stat--on" : ""}`} onClick={() => setStatus(status === s ? "all" : s)}>
              <strong>{counts(s)}</strong><span>{STATUS[s].label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="sn-layout">
        <aside className="sn-side panel">
          <div className="sn-side__top">
            <label className="search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients, sites, stack…" aria-label="Search projects" /></label>
            <button className="btn btn--lantern" onClick={create}><Plus size={15} /> New project</button>
          </div>
          <div className="sn-list">
            {list.map((x) => (
              <button key={x.id} className={`sn-item${x.id === activeId ? " sn-item--on" : ""}`} onClick={() => setActiveId(x.id)}>
                <span className="sn-item__title">{x.site || x.client || "Untitled project"}</span>
                <span className="sn-item__meta">
                  <span className={`chip ${STATUS[x.status].tone}`} style={{ height: 18, fontSize: 11 }}>{STATUS[x.status].label}</span>
                  {x.client && x.site && <span>{x.client}</span>}
                  <span>{[x.stack.platform, x.stack.builder].filter(Boolean).join(" + ")}</span>
                </span>
              </button>
            ))}
            {projects.length > 0 && !list.length && <p className="help" style={{ padding: 14 }}>No projects match.</p>}
          </div>
          <div className="sn-side__foot">
            <button className="btn btn--ghost btn--sm" disabled={!projects.length} onClick={() => downloadText("den-projects.json", JSON.stringify(projects, null, 2), "application/json")}><Download size={14} /> Export</button>
            <label className="btn btn--ghost btn--sm"><Upload size={14} /> Import
              <input type="file" accept=".json" className="visually-hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const incoming = JSON.parse(await f.text()) as Project[];
                  const ids = new Set(projects.map((x) => x.id));
                  setProjects([...incoming.filter((x) => x.id && !ids.has(x.id)), ...projects]);
                } catch { alert("That file isn't a project export."); }
                e.target.value = "";
              }} />
            </label>
          </div>
        </aside>

        <div className="sn-main">
          {!p ? (
            <Panel>
              <Empty icon={<FolderKanban size={30} />} title={projects.length ? "Pick a project" : "Keep every client site in one place"}>
                <p>URLs, stack, hosting, contacts and notes for each client — with one-click PageSpeed, site checks and maintenance reports.</p>
                {!projects.length && <div className="row" style={{ justifyContent: "center", marginTop: 12 }}><button className="btn btn--lantern" onClick={create}><Plus size={15} /> Add your first project</button></div>}
              </Empty>
            </Panel>
          ) : (
            <div className="stack">
              <Panel
                title={<input className="sn-title" value={p.site} placeholder="Site or project name" onChange={(e) => update({ site: e.target.value })} aria-label="Site name" />}
                actions={
                  <>
                    <select className="inp" style={{ width: 150, height: 32 }} value={p.status} onChange={(e) => update({ status: e.target.value as Project["status"] })} aria-label="Status">
                      {(Object.keys(STATUS) as Project["status"][]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </select>
                    <button className="btn btn--ghost btn--sm" onClick={() => { if (confirm(`Delete ${p.site || "this project"}?`)) { setProjects(projects.filter((x) => x.id !== p.id)); setActiveId(null); } }}><Trash2 size={14} /></button>
                  </>
                }
              >
                <div className="row">
                  <TextInput label="Client" value={p.client} onChange={(e) => update({ client: e.target.value })} />
                  <TextInput label="Order / reference" value={p.order} onChange={(e) => update({ order: e.target.value })} placeholder="Fiverr FO1234…" />
                </div>
                {live && (
                  <div className="pj-actions">
                    <a className="btn btn--sm" href={live} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open site</a>
                    <Link className="btn btn--sm" href={`/tools/pagespeed?url=${enc}`}><Gauge size={14} /> PageSpeed</Link>
                    <Link className="btn btn--sm" href={`/tools/site-check?url=${enc}`}><ShieldCheck size={14} /> Headers, SSL & DNS</Link>
                    <Link className="btn btn--sm" href={`/tools/breakpoints?url=${enc}`}><MonitorSmartphone size={14} /> Breakpoints</Link>
                    <Link className="btn btn--sm" href={`/tools/maintenance-report?project=${p.id}`}><ClipboardCheck size={14} /> Maintenance report</Link>
                  </div>
                )}
              </Panel>

              <Panel title="Links" actions={<button className="btn btn--sm" onClick={() => update({ urls: [...p.urls, { label: "", url: "" }] })}><Plus size={14} /> Add link</button>}>
                {p.urls.map((u, i) => (
                  <div className="pj-link" key={i}>
                    <input className="inp" value={u.label} placeholder="Label" aria-label="Link label" onChange={(e) => update({ urls: p.urls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <input className="inp" value={u.url} placeholder="https://" aria-label="URL" onChange={(e) => update({ urls: p.urls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                    {u.url ? <a className="btn btn--ghost btn--sm" href={/^https?:/.test(u.url) ? u.url : `https://${u.url}`} target="_blank" rel="noreferrer" aria-label={`Open ${u.label}`}><ExternalLink size={14} /></a> : <span />}
                    <button className="btn btn--ghost btn--sm" onClick={() => update({ urls: p.urls.filter((_, j) => j !== i) })} aria-label="Remove link"><Trash2 size={13} /></button>
                  </div>
                ))}
              </Panel>

              <Panel title="Stack">
                <div className="row">
                  <Select label="Platform" value={p.stack.platform} onChange={(e) => update({ stack: { ...p.stack, platform: e.target.value } })} options={["WordPress", "WooCommerce", "Shopify", "Next.js", "HubSpot", "Static", "Other"]} />
                  <Select label="Builder" value={p.stack.builder} onChange={(e) => update({ stack: { ...p.stack, builder: e.target.value } })} options={["Elementor", "Divi", "Gutenberg", "Bricks", "Oxygen", "WPBakery", "Beaver Builder", "Shopify sections", "Custom code", "None"]} />
                  <TextInput label="Theme" value={p.stack.theme} onChange={(e) => update({ stack: { ...p.stack, theme: e.target.value } })} placeholder="Hello Elementor child" />
                </div>
                <div className="row">
                  <TextInput label="Hosting" value={p.stack.hosting} onChange={(e) => update({ stack: { ...p.stack, hosting: e.target.value } })} placeholder="Hostinger, SiteGround…" />
                  <TextInput label="DNS / CDN" value={p.stack.dns} onChange={(e) => update({ stack: { ...p.stack, dns: e.target.value } })} placeholder="Cloudflare" />
                  <TextInput label="PHP version" value={p.stack.php} onChange={(e) => update({ stack: { ...p.stack, php: e.target.value } })} placeholder="8.2" />
                </div>
                <TextArea label="Key plugins / apps" rows={2} value={p.stack.plugins} onChange={(e) => update({ stack: { ...p.stack, plugins: e.target.value } })} placeholder="WooCommerce, Rank Math, WP Rocket, UpdraftPlus…" />
              </Panel>

              <Panel title="Contact">
                <div className="row">
                  <TextInput label="Name" value={p.contact.name} onChange={(e) => update({ contact: { ...p.contact, name: e.target.value } })} />
                  <TextInput label="Email" value={p.contact.email} onChange={(e) => update({ contact: { ...p.contact, email: e.target.value } })} />
                  <TextInput label="Phone / WhatsApp" value={p.contact.phone} onChange={(e) => update({ contact: { ...p.contact, phone: e.target.value } })} />
                </div>
              </Panel>

              <Panel title="Notes">
                <TextArea rows={8} value={p.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Scope, quirks, what the client prefers, what not to touch…" />
                <Notice tone="warn">Don&rsquo;t keep passwords here — everything in the Den is stored unencrypted in this browser. Use a password manager and note where the login lives instead.</Notice>
                <p className="help">Saved automatically. Last edited {new Date(p.updatedAt).toLocaleString()}.</p>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </ToolFrame>
  );
}
