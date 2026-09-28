"use client";

import { useEffect, useRef, useState } from "react";
import { GitCompare, ShieldCheck, SlidersHorizontal, RotateCcw, TriangleAlert } from "lucide-react";
import { DEFAULT_OPTIONS, DEFAULT_EXCLUDES, type DiffOptions, type Progress, type Report } from "@/lib/theme-diff/types";
import { runAnalysis } from "@/lib/theme-diff/run";
import { DropSlab } from "./DropSlab";
import { ReportView } from "./ReportView";
import { ToolFrame } from "../ToolFrame";
import "./theme-diff.css";

type State =
  | { kind: "idle" }
  | { kind: "running"; progress: Progress }
  | { kind: "done"; report: Report; before: File; after: File }
  | { kind: "error"; message: string };

const STORE_KEY = "den.theme-diff.options";

function phaseText(p: Progress): string {
  if (p.phase === "reading") return "Unpacking both ZIPs";
  if (p.phase === "comparing") return "Comparing files";
  return "Writing the report";
}

export function ThemeDiffTool() {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [opts, setOpts] = useState<DiffOptions>(DEFAULT_OPTIONS);
  const [excludeText, setExcludeText] = useState(DEFAULT_EXCLUDES.join("\n"));
  const [showOpts, setShowOpts] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const o = { ...DEFAULT_OPTIONS, ...(JSON.parse(saved) as Partial<DiffOptions>) };
        setOpts(o);
        setExcludeText(o.exclude.join("\n"));
      }
    } catch { /* storage unavailable */ }
  }, []);

  const update = (patch: Partial<DiffOptions>) => {
    setOpts((o) => {
      const next = { ...o, ...patch };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const running = state.kind === "running";
  const ready = !!before && !!after && !running;

  const pair = (files: File[]) => {
    // Older file goes on the left.
    const [a, b] = [...files].sort((x, y) => x.lastModified - y.lastModified);
    setBefore(a);
    setAfter(b);
  };

  const compare = async () => {
    if (!before || !after) return;
    setState({ kind: "running", progress: { phase: "reading", done: 0, total: 1 } });
    try {
      const report = await runAnalysis(before, after, opts, (progress) => setState({ kind: "running", progress }));
      setState({ kind: "done", report, before, after });
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "The comparison failed." });
    }
  };

  const pct = state.kind === "running" ? Math.round((state.progress.done / Math.max(1, state.progress.total)) * 100) : 0;

  return (
    <ToolFrame slug="theme-diff" wide>

      <div className={`bench-stage${running ? " bench-stage--running" : ""}`}>
        <DropSlab side="before" file={before} onFile={setBefore} onPair={pair} disabled={running} />

        <div className="junction">
          <div className="junction__wire" aria-hidden="true">
            <span style={{ ["--fill" as string]: running ? `${pct}%` : ready ? "100%" : "0%" }} />
          </div>
          <button type="button" className="lantern-btn" onClick={compare} disabled={!ready} aria-describedby="compare-status">
            <GitCompare size={26} strokeWidth={1.8} />
            <span>{running ? `${pct}%` : state.kind === "done" ? "Compare again" : "Compare"}</span>
          </button>
          <div id="compare-status" className="junction__status" aria-live="polite">
            {state.kind === "running" && phaseText(state.progress)}
            {state.kind !== "running" && !before && !after && "Add both ZIPs to begin"}
            {state.kind !== "running" && (!!before !== !!after) && `Add the ${before ? "after" : "before"} ZIP`}
          </div>
        </div>

        <DropSlab side="after" file={after} onFile={setAfter} onPair={pair} disabled={running} />
      </div>

      <div className="td__sub">
        <span className="td__privacy">
          <ShieldCheck size={15} /> Files are read in this browser tab and never uploaded anywhere.
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowOpts((s) => !s)} aria-expanded={showOpts}>
          <SlidersHorizontal size={14} /> Comparison settings
        </button>
      </div>

      {showOpts && (
        <div className="opts">
          <div className="opts__col">
            <label className="toggle">
              <input type="checkbox" checked={opts.ignoreWhitespace} onChange={(e) => update({ ignoreWhitespace: e.target.checked })} />
              <span>
                <strong>Ignore whitespace changes</strong>
                <small>Re-indented or re-spaced lines won&rsquo;t count as edits.</small>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={opts.ignoreLineEndings} onChange={(e) => update({ ignoreLineEndings: e.target.checked })} />
              <span>
                <strong>Ignore Windows vs Unix line endings</strong>
                <small>Stops every line lighting up when a file was saved on another OS.</small>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={opts.includeUnchanged} onChange={(e) => update({ includeUnchanged: e.target.checked })} />
              <span>
                <strong>List unchanged files too</strong>
                <small>Useful for checking a file really made it into the ZIP.</small>
              </span>
            </label>
            <label className="field">
              <span>Context lines around each change</span>
              <select value={opts.context} onChange={(e) => update({ context: Number(e.target.value) })}>
                {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="opts__col">
            <label className="field field--grow">
              <span>Skip these paths (one pattern per line, <code>**</code> matches any folders)</span>
              <textarea
                rows={6}
                value={excludeText}
                spellCheck={false}
                onChange={(e) => {
                  setExcludeText(e.target.value);
                  update({ exclude: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) });
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setExcludeText(DEFAULT_EXCLUDES.join("\n"));
                update({ ...DEFAULT_OPTIONS });
              }}
            >
              <RotateCcw size={14} /> Reset to defaults
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="td__error" role="alert">
          <TriangleAlert size={18} />
          <div>
            <strong>Couldn&rsquo;t compare these files.</strong> {state.message}
          </div>
        </div>
      )}

      <div ref={reportRef}>
        {state.kind === "done" && <ReportView key={state.report.createdAt} report={state.report} before={state.before} after={state.after} />}
      </div>
    </ToolFrame>
  );
}
