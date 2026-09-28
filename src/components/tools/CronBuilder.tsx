"use client";

import { useEffect, useMemo, useState } from "react";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { ToolFrame } from "../ToolFrame";
import { Grid, Notice, Output, Panel, Select, TextInput } from "../ui";
import { CopyButton } from "../CopyButton";
import { useStored } from "@/lib/store";

const PRESETS: [string, string][] = [
  ["*/5 * * * *", "Every 5 minutes"],
  ["*/15 * * * *", "Every 15 minutes"],
  ["0 * * * *", "Every hour"],
  ["0 */6 * * *", "Every 6 hours"],
  ["0 3 * * *", "Daily at 3 am"],
  ["30 9 * * 1-5", "Weekdays at 9:30"],
  ["0 2 * * 0", "Sundays at 2 am"],
  ["0 4 1 * *", "1st of every month"],
  ["0 0 1 1 *", "Once a year"],
];

const FIELDS = [
  { name: "Minute", range: "0–59", hint: "*/5 = every 5 min" },
  { name: "Hour", range: "0–23", hint: "9-17 = working hours" },
  { name: "Day of month", range: "1–31", hint: "1,15 = 1st and 15th" },
  { name: "Month", range: "1–12", hint: "* = every month" },
  { name: "Day of week", range: "0–6, Sun = 0", hint: "1-5 = Mon–Fri" },
];

const ZONES = ["Asia/Colombo", "UTC", "Europe/London", "Europe/Helsinki", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "Asia/Dubai", "Asia/Singapore"];

export function CronBuilder() {
  const [expr, setExpr] = useStored("den.cron.expr", "*/15 * * * *");
  const [tz, setTz] = useStored("den.cron.tz", "Asia/Colombo");
  const [cmd, setCmd] = useStored("den.cron.cmd", "wpcron");
  const [site, setSite] = useState("https://example.com");
  const [path, setPath] = useState("/home/username/public_html");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const parts = expr.trim().split(/\s+/);
  const setPart = (i: number, v: string) => {
    const p = [...parts];
    while (p.length < 5) p.push("*");
    p[i] = v.replace(/\s+/g, "") || "*";
    setExpr(p.slice(0, 5).join(" "));
  };

  const { description, next, error } = useMemo(() => {
    try {
      const d = cronstrue.toString(expr, { use24HourTimeFormat: true, verbose: true });
      const it = CronExpressionParser.parse(expr, { tz });
      const n: Date[] = [];
      for (let i = 0; i < 8; i++) n.push(it.next().toDate());
      return { description: d, next: n, error: null };
    } catch (e) {
      return { description: "", next: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [expr, tz]);

  const command =
    cmd === "wpcron" ? `wget -q -O - ${site.replace(/\/$/, "")}/wp-cron.php?doing_wp_cron >/dev/null 2>&1`
    : cmd === "wpcli" ? `cd ${path} && wp cron event run --due-now --quiet`
    : cmd === "php" ? `/usr/local/bin/php ${path}/wp-cron.php >/dev/null 2>&1`
    : `/usr/local/bin/php ${path}/script.php`;
  const line = `${expr} ${command}`;

  const fmt = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <ToolFrame slug="cron-builder">
      <Grid>
        <div className="stack">
          <Panel title="Expression">
            <input className="inp inp--code cron-input" value={expr} onChange={(e) => setExpr(e.target.value)} aria-label="Cron expression" spellCheck={false} />
            <div className="cron-fields">
              {FIELDS.map((f, i) => (
                <label key={f.name} className="cron-field">
                  <input className="inp inp--code" value={parts[i] ?? "*"} onChange={(e) => setPart(i, e.target.value)} aria-label={f.name} />
                  <span>{f.name}</span>
                  <span className="muted">{f.range}</span>
                </label>
              ))}
            </div>
            <div className="filters">
              {PRESETS.map(([e, label]) => <button key={e} className={`filter${expr === e ? " filter--on" : ""}`} onClick={() => setExpr(e)}>{label}</button>)}
            </div>
          </Panel>
          <Panel title="Crontab line">
            <Select label="Run" value={cmd} onChange={(e) => setCmd(e.target.value)} options={[["wpcron", "WordPress cron over HTTP (wget)"], ["wpcli", "WP-CLI: due cron events"], ["php", "wp-cron.php with PHP"], ["script", "A PHP script"]]} />
            {cmd === "wpcron" ? <TextInput label="Site URL" value={site} onChange={(e) => setSite(e.target.value)} /> : <TextInput label="Site folder on the server" value={path} onChange={(e) => setPath(e.target.value)} />}
            <Output value={line} label="Add with crontab -e, or cPanel → Cron Jobs" />
            {cmd !== "script" && <p className="help">Pair this with <code>define( &apos;DISABLE_WP_CRON&apos;, true );</code> in wp-config.php so WordPress stops running cron on page loads.</p>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="In plain words">
            {error ? <Notice tone="error">{error}</Notice> : (
              <div className="clamp-value"><code style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--chalk)" }}>{description}</code><CopyButton text={expr} label="Copy" /></div>
            )}
          </Panel>
          <Panel title="Next runs">
            <Select label="Server time zone" value={tz} onChange={(e) => setTz(e.target.value)} options={ZONES} hint="Most hosts run cron in UTC — check with date on the server" />
            <ol className="cron-next">{mounted && next.map((d, i) => <li key={i}><span>{fmt.format(d)}</span><span className="muted">{rel(d)}</span></li>)}</ol>
          </Panel>
          <Panel title="Cheat sheet">
            <table className="tbl"><tbody>
              {[["*", "every value"], [",", "list: 1,15"], ["-", "range: 9-17"], ["/", "step: */10"], ["@daily", "shortcut for 0 0 * * *"], ["@reboot", "once at startup (crontab only)"]].map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td className="muted">{v}</td></tr>)}
            </tbody></table>
          </Panel>
        </div>
      </Grid>
    </ToolFrame>
  );
}

function rel(d: Date): string {
  const m = Math.round((d.getTime() - Date.now()) / 60000);
  if (m < 60) return `in ${m} min`;
  if (m < 1440) return `in ${Math.round(m / 60)} h`;
  return `in ${Math.round(m / 1440)} d`;
}
