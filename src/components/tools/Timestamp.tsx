"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Grid, Notice, Panel, TextArea } from "../ui";
import { CopyButton } from "../CopyButton";
import { useStored } from "@/lib/store";

/** Understands Unix seconds / ms / µs, ISO strings and most date strings. */
function parseAny(input: string): { date: Date; how: string } | null {
  const s = input.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const digits = s.replace(/^-/, "").split(".")[0].length;
    if (digits <= 11) return { date: new Date(n * 1000), how: "Unix seconds" };
    if (digits <= 14) return { date: new Date(n), how: "Unix milliseconds" };
    return { date: new Date(n / 1000), how: "Unix microseconds" };
  }
  // MySQL / WordPress "2026-09-26 08:14:02" — treat as UTC like post_date_gmt
  const mysql = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mysql) return { date: new Date(Date.UTC(+mysql[1], +mysql[2] - 1, +mysql[3], +mysql[4], +mysql[5], +(mysql[6] ?? 0))), how: "Date and time without a zone (read as UTC)" };
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { date: d, how: "Date string" };
  return null;
}

function relative(d: Date): string {
  const s = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), "month");
  return rtf.format(Math.round(s / (86400 * 365)), "year");
}

function inZone(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }).format(d);
}

function mysqlIn(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
}

/** Convert a wall-clock time in a given zone to a Date. */
function fromZone(local: string, tz: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // offset of tz at that moment
  const asTz = new Date(mysqlIn(new Date(guess), tz).replace(" ", "T") + "Z").getTime();
  return new Date(guess - (asTz - guess));
}

const ALL_ZONES: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC", "Asia/Colombo"];

export function Timestamp() {
  const [now, setNow] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [zones, setZones] = useStored<string[]>("den.timestamp.zones", ["Asia/Colombo", "UTC", "Europe/London", "Europe/Helsinki", "America/New_York"]);
  const [addZone, setAddZone] = useState("");
  const [local, setLocal] = useState("");
  const [localTz, setLocalTz] = useState("Asia/Colombo");
  const [batch, setBatch] = useState("");

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => parseAny(input), [input]);
  const date = parsed?.date ?? (now ? new Date(now) : null);
  const fromLocal = local ? fromZone(local, localTz) : null;

  const rows: [string, string][] = date
    ? [
        ["Unix seconds", String(Math.floor(date.getTime() / 1000))],
        ["Unix milliseconds", String(date.getTime())],
        ["ISO 8601 (UTC)", date.toISOString()],
        ["RFC 2822", date.toUTCString()],
        ["MySQL / WordPress GMT", mysqlIn(date, "UTC")],
        ["Relative", relative(date)],
      ]
    : [];

  return (
    <ToolFrame slug="timestamp">
      <Panel>
        <div className="ts-now">
          <span className="muted">Now</span>
          <code className="ts-now__value">{now ? Math.floor(now / 1000) : "—"}</code>
          {now && <CopyButton text={String(Math.floor(now / 1000))} label="Copy" />}
          <span className="muted ts-now__ms">{now ? `${now} ms` : ""}</span>
        </div>
      </Panel>

      <Grid>
        <div className="stack">
          <Panel title="Convert">
            <input className="inp inp--code ts-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="1758873600, 1758873600000, 2026-09-26T08:00:00Z or 2026-09-26 08:00:00" aria-label="Timestamp or date" />
            {input && !parsed && <Notice tone="error">That doesn&rsquo;t look like a timestamp or date.</Notice>}
            {parsed && <p className="help">Read as <strong>{parsed.how}</strong>.</p>}
            {date && (
              <table className="tbl ts-table"><tbody>
                {rows.map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td><code>{v}</code></td><td><CopyButton text={v} label="" /></td></tr>)}
              </tbody></table>
            )}
          </Panel>
          <Panel title="Date and time to timestamp">
            <div className="row">
              <div className="fld"><span className="fld__label">Date and time</span><input className="inp" type="datetime-local" step={1} value={local} onChange={(e) => setLocal(e.target.value)} /></div>
              <div className="fld"><span className="fld__label">In time zone</span>
                <select className="inp" value={localTz} onChange={(e) => setLocalTz(e.target.value)}>{ALL_ZONES.map((z) => <option key={z}>{z}</option>)}</select>
              </div>
            </div>
            {fromLocal && (
              <div className="clamp-value"><code>{Math.floor(fromLocal.getTime() / 1000)}</code><span className="muted">{fromLocal.toISOString()}</span><CopyButton text={String(Math.floor(fromLocal.getTime() / 1000))} label="Copy" /></div>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Around the world">
            {date && (
              <ul className="ts-zones">
                {zones.map((z) => (
                  <li key={z}>
                    <span className="ts-zones__name">{z.replace(/_/g, " ")}</span>
                    <code>{inZone(date, z)}</code>
                    <button className="btn btn--ghost btn--sm" aria-label={`Remove ${z}`} onClick={() => setZones(zones.filter((x) => x !== z))}><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <select className="inp" value={addZone} onChange={(e) => setAddZone(e.target.value)} aria-label="Add time zone" style={{ flex: 1 }}>
                <option value="">Add a time zone…</option>
                {ALL_ZONES.filter((z) => !zones.includes(z)).map((z) => <option key={z}>{z}</option>)}
              </select>
              <button className="btn" disabled={!addZone} onClick={() => { setZones([...zones, addZone]); setAddZone(""); }}><Plus size={14} /> Add</button>
            </div>
          </Panel>
          <Panel title="Convert a list">
            <TextArea code rows={5} value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Paste timestamps, one per line (e.g. from a CSV or log)" />
            {batch.trim() && (
              <pre className="out__pre" style={{ maxHeight: 260 }}>
                {batch.split("\n").filter((l) => l.trim()).map((l) => { const p = parseAny(l); return `${l.trim().padEnd(16)}  ${p ? `${p.date.toISOString()}   ${inZone(p.date, zones[0] ?? "UTC")}` : "?"}`; }).join("\n")}
              </pre>
            )}
          </Panel>
        </div>
      </Grid>
    </ToolFrame>
  );
}
