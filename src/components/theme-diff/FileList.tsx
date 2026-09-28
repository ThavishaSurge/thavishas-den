"use client";

import { Folder } from "lucide-react";
import type { FileResult } from "@/lib/theme-diff/types";

const DOT: Record<FileResult["status"], string> = {
  modified: "var(--mod)", added: "var(--add)", removed: "var(--rem)", renamed: "var(--move)", unchanged: "var(--ash-dim)",
};

export function FileList({ files, selected, onSelect }: { files: FileResult[]; selected: string | null; onSelect: (path: string) => void }) {
  const groups = new Map<string, FileResult[]>();
  for (const f of files) {
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
    groups.set(dir, [...(groups.get(dir) ?? []), f]);
  }
  const dirs = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));

  if (!files.length) {
    return <div className="filelist__empty">No files match. Clear the search or pick another filter.</div>;
  }

  return (
    <div className="filelist" role="listbox" aria-label="Changed files">
      {dirs.map((dir) => (
        <div key={dir || "/"} className="filelist__group">
          <div className="filelist__dir">
            <Folder size={13} />
            <span>{dir || "theme root"}</span>
          </div>
          {groups.get(dir)!.map((f) => {
            const name = f.path.slice(dir ? dir.length + 1 : 0);
            const active = selected === f.path;
            return (
              <button
                key={f.path}
                type="button"
                role="option"
                aria-selected={active}
                data-path={f.path}
                className={`filerow${active ? " filerow--active" : ""}`}
                onClick={() => onSelect(f.path)}
              >
                <span className="filerow__dot" style={{ background: DOT[f.status] }} aria-hidden="true" />
                <span className="filerow__name" title={f.path}>
                  {name}
                  {f.fromPath && <span className="filerow__from">from {f.fromPath}</span>}
                </span>
                <span className="filerow__counts">
                  {f.linesAdded > 0 && <span className="filerow__add">+{f.linesAdded}</span>}
                  {f.linesRemoved > 0 && <span className="filerow__rem">−{f.linesRemoved}</span>}
                  {f.binary && <span className="filerow__bin">bin</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
