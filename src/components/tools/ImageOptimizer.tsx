"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download, ImageDown, Trash2, FileCode2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, FileDrop, Grid, Notice, Output, Panel, Segmented, Select, Tabs, TextArea, downloadBlob, downloadText } from "../ui";
import { drawToCanvas, encodeCanvas, loadBitmap, type OutFormat } from "@/lib/images";
import { formatBytes } from "../theme-diff/DropSlab";
import { useStored } from "@/lib/store";

interface Job {
  id: string;
  file: File;
  status: "waiting" | "working" | "done" | "error";
  out?: Blob;
  outName?: string;
  width?: number;
  height?: number;
  error?: string;
  before?: string;
  after?: string;
}

const EXT: Record<OutFormat, string> = { webp: "webp", avif: "avif", jpeg: "jpg", png: "png" };

function RasterTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [o, setO] = useStored("den.images.opts", { format: "webp" as OutFormat | "same", quality: 0.8, maxWidth: "1920" });
  const [running, setRunning] = useState(false);
  const [compare, setCompare] = useState<string | null>(null);

  const add = (files: File[]) => {
    const imgs = files.filter((f) => /^image\/(png|jpe?g|webp|avif|gif|bmp)$/.test(f.type));
    setJobs((j) => [...j, ...imgs.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, status: "waiting" as const, before: URL.createObjectURL(file) }))]);
  };

  const run = async (list = jobs) => {
    setRunning(true);
    for (const job of list) {
      setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, status: "working", error: undefined } : x)));
      try {
        const bmp = await loadBitmap(job.file);
        const fmt: OutFormat = o.format === "same" ? (job.file.type.includes("png") ? "png" : job.file.type.includes("webp") ? "webp" : job.file.type.includes("avif") ? "avif" : "jpeg") : o.format;
        const canvas = drawToCanvas(bmp, parseInt(o.maxWidth) || null, fmt === "jpeg" ? "#ffffff" : undefined);
        const out = await encodeCanvas(canvas, fmt, o.quality);
        const outName = job.file.name.replace(/\.[^.]+$/, "") + "." + EXT[fmt];
        setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, status: "done", out, outName, width: canvas.width, height: canvas.height, after: URL.createObjectURL(out) } : x)));
      } catch (e) {
        setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, status: "error", error: e instanceof Error ? e.message : "Failed" } : x)));
      }
    }
    setRunning(false);
  };

  const done = jobs.filter((j) => j.out);
  const before = done.reduce((s, j) => s + j.file.size, 0);
  const after = done.reduce((s, j) => s + (j.out?.size ?? 0), 0);
  const cmp = jobs.find((j) => j.id === compare);

  return (
    <div className="stack">
      <Grid>
        <FileDrop multiple accept="image/png,image/jpeg,image/webp,image/avif,image/gif" label="Drop images to compress" hint="JPG, PNG, WebP, AVIF or GIF. Several at once is fine." icon={<ImageDown size={26} />} onFiles={add} />
        <Panel title="Settings">
          <Segmented label="Output format" value={o.format} onChange={(v) => setO({ ...o, format: v })}
            options={[["webp", "WebP"], ["avif", "AVIF"], ["jpeg", "JPEG"], ["png", "PNG"], ["same", "Keep format"]]} />
          <div className="fld">
            <span className="fld__label">Quality {Math.round(o.quality * 100)}{o.format === "png" ? " (PNG is lossless — quality doesn't apply)" : ""}</span>
            <input type="range" className="range" min={0.3} max={1} step={0.01} value={o.quality} onChange={(e) => setO({ ...o, quality: +e.target.value })} />
          </div>
          <Select label="Resize to max width" value={o.maxWidth} onChange={(e) => setO({ ...o, maxWidth: e.target.value })}
            options={[["", "Keep original size"], ["2560", "2560px"], ["1920", "1920px — full-width hero"], ["1440", "1440px"], ["1200", "1200px — blog content"], ["800", "800px — product grid"], ["400", "400px — thumbnail"]]} />
          <div className="row">
            <button className="btn btn--lantern" onClick={() => run()} disabled={!jobs.length || running}>{running ? "Compressing…" : `Compress ${jobs.length || ""} image${jobs.length === 1 ? "" : "s"}`}</button>
            {done.length > 1 && (
              <button className="btn" onClick={async () => {
                const zip = new JSZip();
                done.forEach((j) => zip.file(j.outName!, j.out!));
                downloadBlob("optimised-images.zip", await zip.generateAsync({ type: "blob" }));
              }}><Download size={15} /> Download all (.zip)</button>
            )}
          </div>
          {o.format === "avif" && <p className="help">AVIF is encoded with a WebAssembly encoder — expect a second or two per image.</p>}
        </Panel>
      </Grid>

      {jobs.length > 0 && (
        <Panel
          title={done.length ? `Saved ${formatBytes(Math.max(0, before - after))} (${before ? Math.round((1 - after / before) * 100) : 0}%) across ${done.length} image${done.length > 1 ? "s" : ""}` : `${jobs.length} image${jobs.length > 1 ? "s" : ""} ready`}
          actions={<button className="btn btn--ghost btn--sm" onClick={() => { setJobs([]); setCompare(null); }}><Trash2 size={14} /> Clear</button>}
          pad={false}
        >
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl">
              <thead><tr><th>File</th><th className="num">Original</th><th className="num">Optimised</th><th className="num">Saved</th><th>Size</th><th /></tr></thead>
              <tbody>
                {jobs.map((j) => {
                  const pct = j.out ? Math.round((1 - j.out.size / j.file.size) * 100) : null;
                  return (
                    <tr key={j.id}>
                      <td>
                        <span className="img-row">
                          <img src={j.after ?? j.before} alt="" className="img-thumb" />
                          <span>{j.outName ?? j.file.name}{j.error && <span className="t-rem"><br />{j.error}</span>}</span>
                        </span>
                      </td>
                      <td className="num muted">{formatBytes(j.file.size)}</td>
                      <td className="num">{j.status === "working" ? "…" : j.out ? formatBytes(j.out.size) : "—"}</td>
                      <td className={`num ${pct !== null && pct > 0 ? "t-add" : pct !== null ? "t-mod" : ""}`}>{pct === null ? "" : pct > 0 ? `−${pct}%` : `+${-pct}%`}</td>
                      <td className="muted">{j.width ? `${j.width}×${j.height}` : ""}</td>
                      <td>
                        {j.out && (
                          <span className="row" style={{ flexWrap: "nowrap" }}>
                            <button className="btn btn--ghost btn--sm" onClick={() => setCompare(compare === j.id ? null : j.id)}>Compare</button>
                            <button className="btn btn--ghost btn--sm" onClick={() => downloadBlob(j.outName!, j.out!)}><Download size={14} /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {cmp?.after && cmp.before && <CompareSlider before={cmp.before} after={cmp.after} label={cmp.outName!} />}
    </div>
  );
}

function CompareSlider({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  return (
    <Panel title={`Before / after: ${label}`}>
      <div className="cmp">
        <img src={before} alt="Original" />
        <div className="cmp__after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><img src={after} alt="Optimised" /></div>
        <div className="cmp__line" style={{ left: `${pos}%` }} />
        <span className="cmp__tag cmp__tag--l">Original</span>
        <span className="cmp__tag cmp__tag--r">Optimised</span>
      </div>
      <input type="range" className="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Compare position" />
    </Panel>
  );
}

function SvgTab() {
  const [src, setSrc] = useState("");
  const [name, setName] = useState("icon.svg");
  const [out, setOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [o, setO] = useStored("den.svgo.opts", { multipass: true, keepViewBox: true, removeDims: false, prefixIds: false, precision: 3 });

  const run = async (text = src) => {
    if (!text.trim()) return;
    try {
      const { optimize } = await import("svgo/browser");
      const res = optimize(text, {
        multipass: o.multipass,
        floatPrecision: o.precision,
        plugins: [
          "preset-default",
          // SVGO 4 keeps viewBox by default; only strip it when asked
          ...(o.keepViewBox ? [] : ["removeViewBox" as const]),
          ...(o.removeDims ? ["removeDimensions" as const] : []),
          ...(o.prefixIds ? [{ name: "prefixIds" as const, params: { prefix: name.replace(/\.svg$/, "").replace(/\W+/g, "-") } }] : []),
        ],
      });
      setOut(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "That SVG couldn't be parsed.");
    }
  };

  const before = new Blob([src]).size, after = new Blob([out]).size;
  const dataUri = out ? `data:image/svg+xml,${encodeURIComponent(out).replace(/%20/g, " ").replace(/%3D/g, "=").replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%22/g, "'")}` : "";

  return (
    <Grid>
      <div className="stack">
        <FileDrop accept=".svg,image/svg+xml" label="Drop an SVG" hint="…or paste the code below" icon={<FileCode2 size={24} />} onFiles={async ([f]) => { const t = await f.text(); setSrc(t); setName(f.name); run(t); }} />
        <Panel title="SVG code" actions={<button className="btn btn--lantern btn--sm" onClick={() => run()} disabled={!src.trim()}>Optimise</button>}>
          <TextArea code rows={10} value={src} onChange={(e) => setSrc(e.target.value)} placeholder="<svg …>" />
          <Check label="Multipass (smaller, slower)" checked={o.multipass} onChange={(v) => setO({ ...o, multipass: v })} />
          <Check label="Keep viewBox" hint="Needed for the SVG to scale with CSS" checked={o.keepViewBox} onChange={(v) => setO({ ...o, keepViewBox: v })} />
          <Check label="Remove width and height" hint="Size it with CSS instead" checked={o.removeDims} onChange={(v) => setO({ ...o, removeDims: v })} />
          <Check label="Prefix IDs with the file name" hint="Avoids clashes when several inline SVGs share a page" checked={o.prefixIds} onChange={(v) => setO({ ...o, prefixIds: v })} />
          <Select label="Decimal precision" value={String(o.precision)} onChange={(e) => setO({ ...o, precision: +e.target.value })} options={["1", "2", "3", "4"]} />
        </Panel>
      </div>
      <Panel title="Optimised">
        {error && <Notice tone="error">{error}</Notice>}
        {out ? (
          <>
            <div className="kvs">
              <div className="kv"><span className="kv__value">{formatBytes(before)}</span><span className="kv__label">before</span></div>
              <div className="kv"><span className="kv__value">{formatBytes(after)}</span><span className="kv__label">after</span></div>
              <div className="kv kv--add"><span className="kv__value">−{before ? Math.round((1 - after / before) * 100) : 0}%</span><span className="kv__label">smaller</span></div>
            </div>
            <div className="svg-prev">
              <div><span className="muted">Before</span><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`} alt="Original SVG" /></div>
              <div><span className="muted">After</span><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(out)}`} alt="Optimised SVG" /></div>
            </div>
            <Output value={out} label="SVG" maxHeight={240} />
            <Output value={`background-image: url("${dataUri}");`} label="As a CSS background" maxHeight={120} />
            <button className="btn" onClick={() => downloadText(name.replace(/\.svg$/, "") + ".min.svg", out, "image/svg+xml")}><Download size={15} /> Download SVG</button>
          </>
        ) : (
          !error && <p className="help">Uses SVGO&rsquo;s default preset: strips editor metadata, comments and hidden elements, and shortens paths.</p>
        )}
      </Panel>
    </Grid>
  );
}

export function ImageOptimizer() {
  const [tab, setTab] = useState<"raster" | "svg">("raster");
  return (
    <ToolFrame slug="image-optimizer" wide>
      <Tabs value={tab} onChange={setTab} tabs={[["raster", "Compress & convert"], ["svg", "SVG optimiser"]]} />
      {tab === "raster" ? <RasterTab /> : <SvgTab />}
    </ToolFrame>
  );
}
