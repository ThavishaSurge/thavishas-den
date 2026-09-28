"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileArchive, FileDown, Search, Keyboard, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { setLastDiff } from "@/lib/handoff";
import type { FileResult, Report } from "@/lib/theme-diff/types";
import { buildChangedZip, download, toMarkdown, toPatch } from "@/lib/theme-diff/export";
import { FileList } from "./FileList";
import { FileDetail } from "./FileDetail";
import { CopyButton } from "../CopyButton";

type Filter = "all" | FileResult["status"];

function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  const v = useCountUp(value);
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__value">{v.toLocaleString()}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export function ReportView({ report, before, after }: { report: Report; before: File; after: File }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(report.files[0]?.path ?? null);
  const [zipping, setZipping] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = report.totals;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.files.filter(
      (f) => (filter === "all" || f.status === filter) && (!q || f.path.toLowerCase().includes(q) || f.fromPath?.toLowerCase().includes(q)),
    );
  }, [report.files, filter, query]);

  // keep the selection inside the visible list
  useEffect(() => {
    if (visible.length && !visible.some((f) => f.path === selected)) setSelected(visible[0].path);
  }, [visible, selected]);

  const ordered = useMemo(() => {
    // same order the list renders in: grouped by folder, root first
    const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
    return [...visible].sort((a, b) => {
      const da = dirOf(a.path), db = dirOf(b.path);
      if (da !== db) return da === "" ? -1 : db === "" ? 1 : da.localeCompare(db);
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [visible]);

  // j / k to move between files
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      const i = ordered.findIndex((f) => f.path === selected);
      const next = ordered[Math.max(0, Math.min(ordered.length - 1, i + (e.key === "j" ? 1 : -1)))];
      if (next) {
        setSelected(next.path);
        document.querySelector(`[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, selected]);

  const current = report.files.find((f) => f.path === selected) ?? null;

  const select = (p: string) => {
    setSelected(p);
    if (window.innerWidth < 1000) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const counts: Record<Filter, number> = {
    all: report.files.length, modified: t.modified, added: t.added, removed: t.removed, renamed: t.renamed,
    unchanged: report.files.filter((f) => f.status === "unchanged").length,
  };
  const FILTERS: [Filter, string][] = [
    ["all", "All"], ["modified", "Modified"], ["added", "New"], ["removed", "Deleted"], ["renamed", "Moved"],
    ...(counts.unchanged ? ([["unchanged", "Unchanged"]] as [Filter, string][]) : []),
  ];

  const base = (report.afterRoot ?? report.afterName.replace(/\.zip$/i, "")) || "theme";
  const bm = report.beforeMeta, am = report.afterMeta;
  const totalChanged = t.modified + t.added + t.removed + t.renamed;

  return (
    <section className="report" aria-label="Comparison report">
      <header className="report__head">
        <div>
          <h2 className="report__title">{am.name ?? bm.name ?? base}</h2>
          <p className="report__sub">
            {am.kind ?? "Theme"}
            {(bm.version || am.version) && (
              <>
                {", version "}
                <span className="report__ver">{bm.version ?? "?"}</span>
                {" to "}
                <span className="report__ver report__ver--new">{am.version ?? "?"}</span>
              </>
            )}
            {". "}Compared {t.filesBefore.toLocaleString()} and {t.filesAfter.toLocaleString()} files in {(report.durationMs / 1000).toFixed(1)}s
            {t.excluded > 0 && `, skipped ${t.excluded} excluded`}.
          </p>
        </div>
        <div className="report__exports">
          <button className="btn" onClick={() => { setLastDiff({ report, after }); router.push("/tools/delivery-notes"); }}>
            <Send size={16} /> Write delivery notes
          </button>
          <button className="btn" onClick={() => download(`${base}-changes.md`, toMarkdown(report), "text/markdown")}>
            <FileDown size={16} /> Report (.md)
          </button>
          <button className="btn" onClick={() => download(`${base}.patch`, toPatch(report.files), "text/x-diff")}>
            <Download size={16} /> Patch
          </button>
          <button
            className="btn btn--lantern"
            disabled={zipping || totalChanged === 0}
            onClick={async () => {
              setZipping(true);
              try {
                download(`${base}-changed-files.zip`, await buildChangedZip(report, report.files, after));
              } finally {
                setZipping(false);
              }
            }}
          >
            <FileArchive size={16} /> {zipping ? "Packing…" : "Changed files (.zip)"}
          </button>
        </div>
      </header>

      <div className="stats">
        <Stat value={t.modified} label="modified" tone="mod" />
        <Stat value={t.added} label="new" tone="add" />
        <Stat value={t.removed} label="deleted" tone="rem" />
        <Stat value={t.renamed} label="moved" tone="move" />
        <div className="stats__lines">
          <span className="stats__plus">+{t.linesAdded.toLocaleString()}</span>
          <span className="stats__minus">−{t.linesRemoved.toLocaleString()}</span>
          <span className="stats__lines-label">lines across {t.changes.toLocaleString()} edits</span>
        </div>
        {totalChanged > 0 && (
          <div className="stats__bar" aria-hidden="true">
            <i style={{ flex: t.modified, background: "var(--mod)" }} />
            <i style={{ flex: t.added, background: "var(--add)" }} />
            <i style={{ flex: t.removed, background: "var(--rem)" }} />
            <i style={{ flex: t.renamed, background: "var(--move)" }} />
          </div>
        )}
      </div>

      {totalChanged === 0 && counts.unchanged === 0 ? (
        <div className="report__empty">
          <h3>These two themes are identical</h3>
          <p>
            No file content changed{report.options.ignoreWhitespace ? " (whitespace-only edits are being ignored)" : ""}. Check you uploaded the edited copy as the after ZIP.
          </p>
        </div>
      ) : (
        <div className="workspace">
          <aside className="workspace__side">
            <div className="toolbar">
              <label className="search">
                <Search size={15} />
                <span className="visually-hidden">Search files</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files" />
              </label>
              <div className="filters" role="group" aria-label="Filter by status">
                {FILTERS.map(([k, label]) =>
                  counts[k] || k === "all" ? (
                    <button key={k} className={`filter${filter === k ? " filter--on" : ""} filter--${k}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>
                      {label} <span>{counts[k]}</span>
                    </button>
                  ) : null,
                )}
              </div>
            </div>
            <FileList files={visible} selected={selected} onSelect={select} />
            <div className="workspace__hint">
              <Keyboard size={13} /> Press <kbd>j</kbd> and <kbd>k</kbd> to step through files
              <CopyButton text={toMarkdown(report, visible)} label="Copy list as Markdown" />
            </div>
          </aside>
          <div className="workspace__main" ref={detailRef}>
            {current ? <FileDetail file={current} before={before} after={after} /> : null}
          </div>
        </div>
      )}
    </section>
  );
}
