"use client";

import { useEffect, useState } from "react";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { exportAll, importAll } from "@/lib/store";
import { FileDrop, Notice, Panel, Segmented, downloadText } from "./ui";

const LABELS: Record<string, string> = {
  "den.snippets": "Snippet library",
  "den.regex.saved": "Saved regex patterns",
  "den.projects": "Projects",
  "den.maintenance.reports": "Maintenance reports",
  "den.pagespeed.history": "PageSpeed history",
  "den.pins": "Pinned tools",
};

export function BackupView() {
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [tick, force] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});
  useEffect(() => setData(exportAll()), [tick]);
  const keys = Object.keys(data);

  return (
    <div className="tool">
      <header className="tool__head">
        <div className="tool__title-row">
          <h1 className="tool__title">Backup &amp; restore</h1>
        </div>
        <p className="tool__lede">
          Snippets, projects, reports, saved patterns and settings are stored in this browser. Download a backup to move them to another computer or keep them safe.
        </p>
      </header>

      <Panel title="What's stored here">
        {keys.length === 0 ? (
          <p className="help">Nothing saved yet.</p>
        ) : (
          <ul className="backup-list">
            {keys.map((k) => {
              const v = data[k];
              const count = Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : typeof v === "object" && v ? `${Object.keys(v).length} entries` : "setting";
              return (
                <li key={k}>
                  <span>{LABELS[k] ?? k.replace(/^den\./, "")}</span>
                  <span className="muted">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <button
            className="btn btn--lantern"
            disabled={!keys.length}
            onClick={() => downloadText(`thavishas-den-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "thavishas-den", version: 1, data: exportAll() }, null, 2), "application/json")}
          >
            <Download size={16} /> Download backup
          </button>
        </div>
      </Panel>

      <Panel title="Restore from a backup">
        <Segmented
          label="Restore mode"
          value={mode}
          onChange={setMode}
          options={[["merge", "Merge with what's here"], ["replace", "Replace everything"]]}
        />
        <FileDrop
          accept=".json,application/json"
          label="Drop a Den backup file"
          hint="The .json file from Download backup"
          icon={<Upload size={22} />}
          onFiles={async ([f]) => {
            try {
              const parsed = JSON.parse(await f.text());
              const payload = parsed?.data ?? parsed;
              if (typeof payload !== "object" || !payload) throw new Error("bad");
              const n = importAll(payload, mode);
              setMsg({ tone: "ok", text: `Restored ${n} item${n === 1 ? "" : "s"} from ${f.name}.` });
              force((x) => x + 1);
            } catch {
              setMsg({ tone: "error", text: `${f.name} isn't a Den backup. Use the .json file created by Download backup.` });
            }
          }}
        />
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Panel>
      <p className="help" style={{ marginTop: 16 }}>
        <DatabaseBackup size={13} style={{ verticalAlign: -2 }} /> Clearing your browser data removes everything stored here, so keep a recent backup.
      </p>
    </div>
  );
}
