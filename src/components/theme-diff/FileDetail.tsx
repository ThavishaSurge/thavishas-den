"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft, FilePen, FilePlus, FileMinus, FileSymlink, TriangleAlert, Check, ListChecks, Rows2, Columns2, FileCode,
} from "lucide-react";
import type { FileResult } from "@/lib/theme-diff/types";
import { RECOMMENDATION_TEXT } from "@/lib/theme-diff/export";
import { imageMime, entryUrl } from "@/lib/theme-diff/zipCache";
import { ChangeCard } from "./ChangeCard";
import { UnifiedView, SplitView } from "./DiffViews";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "../CopyButton";
import { formatBytes } from "./DropSlab";

type View = "steps" | "unified" | "split";

const STATUS_LABEL: Record<FileResult["status"], string> = {
  modified: "Modified", added: "New file", removed: "Deleted", renamed: "Moved", unchanged: "Unchanged",
};

export const STATUS_TONE: Record<FileResult["status"], string> = {
  modified: "tone-change", added: "tone-add", removed: "tone-remove", renamed: "tone-move", unchanged: "tone-info",
};

const REC_ICON = {
  "apply-edits": FilePen, "replace-file": FileCode, "upload-new": FilePlus, "delete-file": FileMinus,
  "move-file": FileSymlink, "move-and-edit": ArrowRightLeft, none: Check,
} as const;

function ImageCompare({ file, before, after }: { file: FileResult; before: File; after: File }) {
  const [urls, setUrls] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [broken, setBroken] = useState<{ a?: boolean; b?: boolean }>({});
  const mime = imageMime(file.path);
  useEffect(() => {
    if (!mime) return;
    let alive = true;
    const made: string[] = [];
    Promise.all([
      file.beforeZipPath ? entryUrl(before, file.beforeZipPath, mime) : Promise.resolve(null),
      file.afterZipPath ? entryUrl(after, file.afterZipPath, mime) : Promise.resolve(null),
    ]).then(([a, b]) => {
      if (a) made.push(a);
      if (b) made.push(b);
      if (alive) {
        setBroken({});
        setUrls({ a, b });
      }
    });
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file, before, after, mime]);
  if (!mime) return null;
  return (
    <div className="imgcmp">
      {(["a", "b"] as const).map((k) =>
        (k === "a" ? file.beforeZipPath : file.afterZipPath) ? (
          <figure key={k} className="imgcmp__side">
            <div className="imgcmp__frame">
              {broken[k] ? (
                <span>No preview for this file</span>
              ) : urls[k] ? (
                <img src={urls[k]!} alt={`${k === "a" ? "Before" : "After"}: ${file.path}`} onError={() => setBroken((b) => ({ ...b, [k]: true }))} />
              ) : null}
            </div>
            <figcaption>{k === "a" ? "Before" : "After"}<span>{formatBytes(k === "a" ? file.sizeBefore : file.sizeAfter)}</span></figcaption>
          </figure>
        ) : null,
      )}
    </div>
  );
}

export function FileDetail({ file, before, after }: { file: FileResult; before: File; after: File }) {
  const hasSteps = file.changes.length > 0;
  const [view, setView] = useState<View>("steps");
  useEffect(() => setView("steps"), [file.path]);

  const RecIcon = REC_ICON[file.recommendation];
  const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/") + 1) : "";
  const name = file.path.slice(dir.length);

  const contentRows = useMemo(() => {
    if (!file.content) return [];
    const lines = file.content.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return lines.map((text, i) => ({ no: i + 1, text, tone: (file.status === "added" ? "add" : "remove") as "add" | "remove" }));
  }, [file]);

  return (
    <div className="detail">
      <header className="detail__head">
        <div className="detail__path">
          <span className="detail__dir">{dir}</span>
          <span className="detail__name">{name}</span>
        </div>
        <div className="detail__meta">
          <span className={`chip ${STATUS_TONE[file.status]}`}>{STATUS_LABEL[file.status]}</span>
          <span className="chip tone-info">{file.language}</span>
          {file.linesAdded > 0 && <span className="detail__count detail__count--add">+{file.linesAdded}</span>}
          {file.linesRemoved > 0 && <span className="detail__count detail__count--rem">−{file.linesRemoved}</span>}
          <CopyButton text={file.path} label="Copy path" />
        </div>
      </header>

      {file.fromPath && (
        <p className="detail__moved">
          <ArrowRightLeft size={14} /> Moved from <code>{file.fromPath}</code>
        </p>
      )}

      <div className={`advice advice--${file.recommendation}`}>
        <RecIcon size={18} strokeWidth={1.8} />
        <div>
          <strong>{RECOMMENDATION_TEXT[file.recommendation]}</strong>
          <span className="advice__why">
            {file.recommendation === "apply-edits" && ` — ${file.changes.length} edit${file.changes.length === 1 ? "" : "s"}, top to bottom.`}
            {file.recommendation === "replace-file" && (file.binary
              ? " — binary files can't be edited line by line."
              : file.minified
                ? " — it's minified, so line edits aren't practical."
                : ` — ${Math.round(file.churn * 100)}% of the file changed. The individual edits are still listed below.`)}
            {file.recommendation === "upload-new" && " — it doesn't exist in the before theme."}
            {file.recommendation === "delete-file" && " — it's gone from the after theme."}
            {file.recommendation === "move-file" && " — the content is identical, only the location changed."}
            {file.recommendation === "move-and-edit" && ` — then ${file.changes.length} edit${file.changes.length === 1 ? "" : "s"}.`}
            {file.cosmeticOnly === "line-endings" && " — only line endings differ."}
          </span>
        </div>
      </div>

      {file.highlights.length > 0 && (
        <ul className="highlights">
          {file.highlights.map((h, i) => (
            <li key={i} className={`chip ${h.tone === "add" ? "tone-add" : h.tone === "remove" ? "tone-remove" : h.tone === "change" ? "tone-change" : "tone-info"}`}>
              {h.text}
            </li>
          ))}
        </ul>
      )}

      {file.tooLarge && (
        <p className="detail__note"><TriangleAlert size={16} /> This file is too large to compare line by line in the browser.</p>
      )}

      {file.binary && <ImageCompare file={file} before={before} after={after} />}

      {hasSteps && (
        <>
          <div className="viewtabs" role="tablist" aria-label="View">
            {([
              ["steps", "Steps", ListChecks],
              ["unified", "Unified", Rows2],
              ["split", "Side by side", Columns2],
            ] as const).map(([v, label, Icon]) => (
              <button key={v} role="tab" aria-selected={view === v} className="viewtabs__tab" onClick={() => setView(v)}>
                <Icon size={15} /> {label}
              </button>
            ))}
            {file.patch && <CopyButton text={file.patch} label="Copy patch" className="viewtabs__copy" />}
          </div>
          {view === "steps" && (
            <div className="steps">
              {file.changes.map((c, i) => <ChangeCard key={c.id} change={c} index={i + 1} />)}
            </div>
          )}
          {view === "unified" && <UnifiedView hunks={file.hunks} />}
          {view === "split" && <SplitView hunks={file.hunks} />}
        </>
      )}

      {file.content !== undefined && (
        <div className="step__block">
          <div className="step__block-head">
            <span>{file.status === "added" ? "Full contents of the new file" : "Contents being deleted"}</span>
            {file.status === "added" && <CopyButton text={file.content} label="Copy file" />}
          </div>
          <CodeBlock rows={contentRows} maxRows={400} />
        </div>
      )}

      {file.status === "unchanged" && <p className="detail__note"><Check size={16} /> Identical in both themes.</p>}
    </div>
  );
}
