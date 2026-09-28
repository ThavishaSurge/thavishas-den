"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, RotateCw, ShieldAlert, Plus, X, MonitorSmartphone } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Notice } from "../ui";
import { useStored } from "@/lib/store";
import { useQueryParam } from "@/lib/handoff";

interface Device {
  id: string;
  name: string;
  w: number;
  h: number;
}

const PRESETS: Device[] = [
  { id: "m", name: "Mobile", w: 375, h: 812 },
  { id: "ml", name: "Large mobile", w: 430, h: 932 },
  { id: "t", name: "Tablet", w: 768, h: 1024 },
  { id: "tl", name: "Tablet landscape", w: 1024, h: 768 },
  { id: "l", name: "Laptop", w: 1366, h: 768 },
  { id: "d", name: "Desktop", w: 1440, h: 900 },
  { id: "w", name: "Wide", w: 1920, h: 1080 },
];

function Frame({ d, src, reloadKey, fit, onRotate, onRemove }: { d: Device; src: string; reloadKey: number; fit: number; onRotate: () => void; onRemove?: () => void }) {
  const scale = Math.min(1, fit / d.w);
  return (
    <figure className="bp-frame" style={{ width: d.w * scale }}>
      <figcaption className="bp-cap">
        <span>
          <strong>{d.name}</strong> <span className="muted">{d.w}×{d.h}{scale < 1 ? ` at ${Math.round(scale * 100)}%` : ""}</span>
        </span>
        <span className="bp-cap__actions">
          <button className="btn btn--ghost btn--sm" onClick={onRotate} title="Rotate" aria-label={`Rotate ${d.name}`}><RotateCw size={13} /></button>
          {onRemove && <button className="btn btn--ghost btn--sm" onClick={onRemove} title="Remove" aria-label={`Remove ${d.name}`}><X size={13} /></button>}
        </span>
      </figcaption>
      <div className="bp-screen" style={{ width: d.w * scale, height: d.h * scale }}>
        <iframe
          key={reloadKey}
          src={src}
          title={`${d.name} preview`}
          style={{ width: d.w, height: d.h, transform: `scale(${scale})` }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </figure>
  );
}

export function Breakpoints() {
  const [url, setUrl] = useStored<string>("den.breakpoints.url", "");
  const [draft, setDraft] = useState(url);
  const [active, setActive] = useStored<string[]>("den.breakpoints.devices", ["m", "t", "d"]);
  const [custom, setCustom] = useStored<Device[]>("den.breakpoints.custom", []);
  const [rotated, setRotated] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [fit, setFit] = useState(420);
  const [cw, setCw] = useState("");
  const [ch, setCh] = useState("");
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(url), [url]);
  const qUrl = useQueryParam("url");
  useEffect(() => { if (qUrl) setUrl(qUrl); }, [qUrl, setUrl]);

  // work out how wide each frame can be
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const n = Math.max(1, active.length + custom.length);
      const avail = el.clientWidth;
      setFit(Math.max(240, Math.min(avail, (avail - (n - 1) * 20) / Math.min(n, 3))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [active.length, custom.length]);

  // warn when the site forbids framing
  useEffect(() => {
    setBlocked(null);
    if (!url) return;
    let alive = true;
    fetch(`/api/redirects?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d: { hops?: { headers: Record<string, string> }[] }) => {
        const h = d.hops?.[d.hops.length - 1]?.headers;
        if (!h || !alive) return;
        const xfo = h["x-frame-options"];
        const csp = h["content-security-policy"]?.match(/frame-ancestors([^;]*)/i)?.[1]?.trim();
        if (xfo && /deny|sameorigin/i.test(xfo)) setBlocked(`The site sends X-Frame-Options: ${xfo}, so browsers won't show it inside these frames.`);
        else if (csp && !/\*/.test(csp)) setBlocked(`The site's Content-Security-Policy allows framing only from ${csp || "nowhere"}, so these frames will stay blank.`);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);

  const go = () => {
    let u = draft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|192\.168\.|[\w-]+\.local)/.test(u) ? "http://" : "https://") + u;
    setUrl(u);
    setReload((r) => r + 1);
  };

  const devices = [...PRESETS.filter((p) => active.includes(p.id)), ...custom].map((d) =>
    rotated.includes(d.id) ? { ...d, w: d.h, h: d.w } : d,
  );

  return (
    <ToolFrame slug="breakpoints" wide>
      <div className="bp-bar">
        <form className="bp-url" onSubmit={(e) => { e.preventDefault(); go(); }}>
          <input className="inp" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://example.com or localhost:3000" aria-label="URL to preview" />
          <button className="btn btn--lantern" type="submit">Load</button>
        </form>
        <button className="btn" onClick={() => setReload((r) => r + 1)} disabled={!url}><RefreshCw size={14} /> Reload all</button>
        {url && <a className="btn btn--ghost" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
      </div>

      <div className="bp-devices">
        {PRESETS.map((p) => (
          <button key={p.id} className={`filter${active.includes(p.id) ? " filter--on" : ""}`} aria-pressed={active.includes(p.id)}
            onClick={() => setActive(active.includes(p.id) ? active.filter((x) => x !== p.id) : [...active, p.id])}>
            {p.name} <span>{p.w}</span>
          </button>
        ))}
        <form className="bp-custom" onSubmit={(e) => {
          e.preventDefault();
          const w = parseInt(cw), h = parseInt(ch) || Math.round(w * 1.6);
          if (w >= 200 && w <= 3840) {
            setCustom([...custom, { id: `c${Date.now()}`, name: "Custom", w, h }]);
            setCw(""); setCh("");
          }
        }}>
          <input className="inp" value={cw} onChange={(e) => setCw(e.target.value.replace(/\D/g, ""))} placeholder="Width" aria-label="Custom width" />
          <span className="muted">×</span>
          <input className="inp" value={ch} onChange={(e) => setCh(e.target.value.replace(/\D/g, ""))} placeholder="Height" aria-label="Custom height" />
          <button className="btn btn--sm" type="submit" disabled={!cw}><Plus size={14} /> Add size</button>
        </form>
      </div>

      {blocked && <div style={{ marginBottom: 14 }}><Notice tone="warn"><ShieldAlert size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{blocked} Preview a staging or local copy instead, or temporarily relax the header.</Notice></div>}

      <div ref={area} className="bp-area">
        {!url ? (
          <Empty icon={<MonitorSmartphone size={30} />} title="Enter a URL to preview">
            Local dev servers work too, like <code>localhost:3000</code> or <code>mysite.local</code>. Scroll and click inside each frame independently.
          </Empty>
        ) : (
          devices.map((d) => (
            <Frame
              key={d.id}
              d={d}
              src={url}
              reloadKey={reload}
              fit={fit}
              onRotate={() => setRotated(rotated.includes(d.id) ? rotated.filter((x) => x !== d.id) : [...rotated, d.id])}
              onRemove={d.id.startsWith("c") ? () => setCustom(custom.filter((c) => c.id !== d.id)) : undefined}
            />
          ))
        )}
      </div>
    </ToolFrame>
  );
}
