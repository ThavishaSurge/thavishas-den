"use client";

import { useEffect, useState } from "react";
import { FileArchive, FileDown, GitCompare, RefreshCw, Send } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Notice, Panel, Segmented, Select, TextArea, TextInput } from "../ui";
import { CopyButton } from "../CopyButton";
import { DropSlab } from "../theme-diff/DropSlab";
import { runAnalysis } from "@/lib/theme-diff/run";
import { DEFAULT_OPTIONS, type Report } from "@/lib/theme-diff/types";
import { buildChangedZip, download, toMarkdown } from "@/lib/theme-diff/export";
import { writeNotes, type NoteOptions } from "@/lib/notes";
import { getLastDiff } from "@/lib/handoff";
import { useStored } from "@/lib/store";
import { useProjects } from "./Projects";
import "../theme-diff/theme-diff.css";

export function DeliveryNotes() {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [projects] = useProjects();
  const [o, setO] = useStored<NoteOptions>("den.notes.opts", {
    client: "", project: "", order: "", tone: "friendly", install: "upload-zip", includeFiles: true, includeTesting: true, includeBackup: true, revisions: "", signoff: "Thavisha", extra: "",
  });
  const set = (p: Partial<NoteOptions>) => { setO({ ...o, ...p }); setEdited(false); };

  // pick up a comparison just made in Theme Diff
  useEffect(() => {
    const last = getLastDiff();
    if (last) { setReport(last.report); setAfterFile(last.after); }
  }, []);

  useEffect(() => {
    if (report && !edited) setText(writeNotes(report, o));
  }, [report, o, edited]);

  const compare = async () => {
    if (!before || !after) return;
    setError(null);
    setBusy(0);
    try {
      const r = await runAnalysis(before, after, DEFAULT_OPTIONS, (p) => setBusy(Math.round((p.done / Math.max(1, p.total)) * 100)));
      setReport(r);
      setAfterFile(after);
      setEdited(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't compare those ZIPs.");
    } finally {
      setBusy(null);
    }
  };

  const base = report ? (report.afterRoot ?? report.afterName.replace(/\.zip$/i, "")) || "theme" : "theme";

  return (
    <ToolFrame slug="delivery-notes" wide>
      {!report ? (
        <div className="stack">
          <div className="bench-stage">
            <DropSlab side="before" file={before} onFile={setBefore} onPair={(f) => { const [a, b] = [...f].sort((x, y) => x.lastModified - y.lastModified); setBefore(a); setAfter(b); }} disabled={busy !== null} />
            <div className="junction">
              <div className="junction__wire" aria-hidden="true"><span style={{ ["--fill" as string]: before && after ? "100%" : "0%" }} /></div>
              <button type="button" className="lantern-btn" onClick={compare} disabled={!before || !after || busy !== null}>
                <Send size={24} strokeWidth={1.8} />
                <span>{busy !== null ? `${busy}%` : "Write notes"}</span>
              </button>
            </div>
            <DropSlab side="after" file={after} onFile={setAfter} onPair={(f) => { const [a, b] = [...f].sort((x, y) => x.lastModified - y.lastModified); setBefore(a); setAfter(b); }} disabled={busy !== null} />
          </div>
          <p className="help">Or run a comparison in Theme Diff and press <strong>Write delivery notes</strong> there — it carries straight over.</p>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
        <Grid>
          <div className="stack">
            <Panel title="Order" actions={<button className="btn btn--ghost btn--sm" onClick={() => { setReport(null); setAfterFile(null); }}><GitCompare size={14} /> Compare other ZIPs</button>}>
              {projects.length > 0 && (
                <Select label="Fill from a project" value="" onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); if (p) set({ client: p.contact.name || p.client, project: p.site, order: p.order }); }}
                  options={[["", "Choose…"], ...projects.map((p) => [p.id, p.site || p.client] as [string, string])]} />
              )}
              <div className="row">
                <TextInput label="Client name" value={o.client} onChange={(e) => set({ client: e.target.value })} />
                <TextInput label="Order number" value={o.order} onChange={(e) => set({ order: e.target.value })} placeholder="FO123456789" />
              </div>
              <TextInput label="Project / theme name" value={o.project} onChange={(e) => set({ project: e.target.value })} placeholder={report.afterMeta.name ?? base} />
              <Segmented label="Tone" value={o.tone} onChange={(v) => set({ tone: v })} options={[["friendly", "Friendly"], ["professional", "Professional"], ["brief", "Brief"]]} />
            </Panel>
            <Panel title="Include">
              <Select label="Install steps" value={o.install} onChange={(e) => set({ install: e.target.value as NoteOptions["install"] })} options={[["upload-zip", "Upload the full theme ZIP in wp-admin"], ["ftp", "Upload changed files over FTP"], ["none", "No install steps"]]} />
              <Check label="Remind them to back up first" checked={o.includeBackup} onChange={(v) => set({ includeBackup: v })} />
              <Check label="List every changed file" checked={o.includeFiles} onChange={(v) => set({ includeFiles: v })} />
              <Check label="What to test afterwards" checked={o.includeTesting} onChange={(v) => set({ includeTesting: v })} />
              <div className="row">
                <Select label="Revisions included" value={o.revisions} onChange={(e) => set({ revisions: e.target.value })} options={[["", "Don't mention"], "1", "2", "3", "unlimited"]} />
                <TextInput label="Sign off as" value={o.signoff} onChange={(e) => set({ signoff: e.target.value })} />
              </div>
              <TextArea label="Anything else to mention" hint="One point per line" rows={3} value={o.extra} onChange={(e) => set({ extra: e.target.value })} placeholder="The new banner image can be changed in Appearance → Customize" />
            </Panel>
            <Panel title="Attachments">
              <div className="row">
                <button className="btn" disabled={!afterFile} onClick={async () => afterFile && download(`${base}-changed-files.zip`, await buildChangedZip(report, report.files, afterFile))}><FileArchive size={15} /> Changed files (.zip)</button>
                <button className="btn" onClick={() => download(`${base}-changes.md`, toMarkdown(report), "text/markdown")}><FileDown size={15} /> Technical report (.md)</button>
              </div>
            </Panel>
          </div>
          <Panel
            title="Delivery message"
            actions={
              <>
                {edited && <button className="btn btn--ghost btn--sm" onClick={() => setEdited(false)}><RefreshCw size={14} /> Regenerate</button>}
                <CopyButton text={text} label="Copy message" className="btn--copy-strong" />
              </>
            }
          >
            <TextArea rows={30} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} className="dn-text" aria-label="Delivery message" />
            <p className="help">{text.length.toLocaleString()} characters. Edit freely — changing an option on the left rewrites it unless you&rsquo;ve edited the text (then use Regenerate).</p>
          </Panel>
        </Grid>
      )}
    </ToolFrame>
  );
}
