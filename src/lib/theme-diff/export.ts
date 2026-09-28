import JSZip from "jszip";
import { openZip } from "./zipCache";
import type { Change, FileResult, Report } from "./types";

export const RECOMMENDATION_TEXT: Record<FileResult["recommendation"], string> = {
  "apply-edits": "Apply the edits below",
  "replace-file": "Replace the whole file",
  "upload-new": "Upload this new file",
  "delete-file": "Delete this file",
  "move-file": "Move / rename the file",
  "move-and-edit": "Move the file, then apply the edits",
  none: "No action needed",
};

export function describeChange(c: Change): string {
  const range = (a: number, b: number) => (a === b ? `line ${a}` : `lines ${a}–${b}`);
  if (c.kind === "add") {
    return c.insertAfter === 0
      ? `Add ${c.added.length} line${c.added.length > 1 ? "s" : ""} at the top of the file`
      : `Add ${c.added.length} line${c.added.length > 1 ? "s" : ""} after line ${c.insertAfter}`;
  }
  if (c.kind === "remove") return `Remove ${range(c.oldFrom, c.oldTo)}`;
  return `Replace ${range(c.oldFrom, c.oldTo)} with ${c.added.length} new line${c.added.length > 1 ? "s" : ""}`;
}

function fenceLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = { js: "js", mjs: "js", jsx: "jsx", ts: "ts", tsx: "tsx", php: "php", css: "css",
    scss: "scss", less: "less", html: "html", htm: "html", json: "json", twig: "twig", liquid: "liquid", md: "md",
    yml: "yaml", yaml: "yaml", xml: "xml", svg: "xml", sh: "bash" };
  return map[ext] ?? "";
}

function fence(code: string[], lang: string): string {
  const body = code.join("\n");
  const ticks = body.includes("```") ? "````" : "```";
  return `${ticks}${lang}\n${body}\n${ticks}`;
}

export function toMarkdown(r: Report, files: FileResult[] = r.files): string {
  const t = r.totals;
  const out: string[] = [];
  out.push(`# Theme change report`);
  out.push("");
  out.push(`- Before: \`${r.beforeName}\`${r.beforeMeta.version ? ` (v${r.beforeMeta.version})` : ""}`);
  out.push(`- After: \`${r.afterName}\`${r.afterMeta.version ? ` (v${r.afterMeta.version})` : ""}`);
  if (r.afterMeta.name) out.push(`- Theme: ${r.afterMeta.name}${r.afterMeta.kind ? ` — ${r.afterMeta.kind}` : ""}`);
  out.push(`- Generated: ${new Date(r.createdAt).toLocaleString()}`);
  out.push("");
  out.push(`| Modified | Added | Removed | Moved | Lines + | Lines − |`);
  out.push(`|---|---|---|---|---|---|`);
  out.push(`| ${t.modified} | ${t.added} | ${t.removed} | ${t.renamed} | ${t.linesAdded} | ${t.linesRemoved} |`);
  out.push("");

  const groups: [string, FileResult[]][] = [
    ["Files to edit", files.filter((f) => f.status === "modified" && f.recommendation === "apply-edits")],
    ["Files to replace", files.filter((f) => f.status === "modified" && f.recommendation !== "apply-edits")],
    ["Files to move", files.filter((f) => f.status === "renamed")],
    ["New files to upload", files.filter((f) => f.status === "added")],
    ["Files to delete", files.filter((f) => f.status === "removed")],
  ];

  for (const [title, list] of groups) {
    if (!list.length) continue;
    out.push(`## ${title} (${list.length})`);
    out.push("");
    for (const f of list) {
      out.push(`### \`${f.path}\``);
      if (f.fromPath) out.push(`Moved from \`${f.fromPath}\``);
      out.push(`**${RECOMMENDATION_TEXT[f.recommendation]}.** ${f.linesAdded ? `+${f.linesAdded} ` : ""}${f.linesRemoved ? `−${f.linesRemoved}` : ""}`.trim());
      for (const h of f.highlights) out.push(`- ${h.text}`);
      out.push("");
      if (f.changes.length && !f.minified) {
        if (f.recommendation === "replace-file") out.push("_Most of this file changed — replacing it is simpler, but here are the individual edits:_", "");
        f.changes.forEach((c, i) => {
          out.push(`#### ${i + 1}. ${describeChange(c)}${c.scope.length ? ` — in ${c.scope.join(" › ")}` : ""}`);
          if (c.anchorAbove) out.push(`Find: \`${c.anchorAbove.trim().slice(0, 120)}\`${c.anchorAboveNo ? ` (line ${c.anchorAboveNo})` : ""}`);
          out.push("");
          if (c.removed.length) { out.push(c.kind === "replace" ? "Replace this:" : "Remove this:"); out.push(fence(c.removed, fenceLang(f.path))); }
          if (c.added.length) { out.push(c.kind === "replace" ? "With this:" : "Add this:"); out.push(fence(c.added, fenceLang(f.path))); }
          out.push("");
        });
      }
    }
  }
  return out.join("\n");
}

export function toPatch(files: FileResult[]): string {
  return files.filter((f) => f.patch).map((f) => f.patch!.replace(/^=+\n/m, "")).join("\n");
}

/** A ZIP containing the after-versions of everything that changed, plus a deletion list. */
export async function buildChangedZip(r: Report, files: FileResult[], afterFile: File): Promise<Blob> {
  const src = await openZip(afterFile);
  const out = new JSZip();
  const root = (r.afterRoot ?? "theme") + "-changes";
  const folder = out.folder(root)!;
  for (const f of files) {
    if (!f.afterZipPath || f.status === "removed" || f.status === "unchanged") continue;
    const entry = src.file(f.afterZipPath);
    if (entry) folder.file(f.path, await entry.async("uint8array"));
  }
  const deletions = files.filter((f) => f.status === "removed").map((f) => f.path);
  const moves = files.filter((f) => f.status === "renamed").map((f) => `${f.fromPath}  ->  ${f.path}`);
  const notes = [
    `Changed files from ${r.afterName}`,
    `Generated by Thavisha's Den on ${new Date(r.createdAt).toLocaleString()}`,
    "",
    "Upload the contents of this folder over the existing theme.",
    "",
    deletions.length ? `Delete these files from the server:\n${deletions.map((d) => `  - ${d}`).join("\n")}` : "No files need deleting.",
    "",
    moves.length ? `These files moved (delete the old path after uploading):\n${moves.map((m) => `  - ${m}`).join("\n")}` : "",
  ].join("\n");
  folder.file("_DEN-NOTES.txt", notes);
  return out.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function download(name: string, data: Blob | string, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
