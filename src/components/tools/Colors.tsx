"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check as CheckIcon, ImagePlus, Wand2, X } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, FileDrop, Grid, Output, Panel, Segmented, Tabs } from "../ui";
import { CopyButton } from "../CopyButton";
import { contrast, extractPalette, fixContrast, parseColor, rgbToHsl, toHex, type RGB } from "@/lib/color";
import { useStored } from "@/lib/store";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const rgb = parseColor(value);
  return (
    <div className="fld">
      <span className="fld__label">{label}</span>
      <div className="colorfield">
        <input type="color" value={rgb ? toHex(rgb) : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        <input className="inp inp--code" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} aria-label={label} />
      </div>
      {!rgb && <span className="fld__hint t-rem">Use hex, rgb() or hsl()</span>}
    </div>
  );
}

function Grade({ ok, label, need }: { ok: boolean; label: string; need: string }) {
  return (
    <div className={`grade${ok ? " grade--ok" : " grade--fail"}`}>
      {ok ? <CheckIcon size={16} /> : <X size={16} />}
      <span><strong>{label}</strong><span className="muted"> needs {need}</span></span>
    </div>
  );
}

function ContrastTab({ fg, bg, setFg, setBg }: { fg: string; bg: string; setFg: (v: string) => void; setBg: (v: string) => void }) {
  const a = parseColor(fg), b = parseColor(bg);
  const ratio = a && b ? contrast(a, b) : 0;
  const fixAA = a && b && ratio < 4.5 ? fixContrast(a, b, 4.5) : null;
  const fixAAA = a && b && ratio < 7 ? fixContrast(a, b, 7) : null;

  return (
    <Grid>
      <Panel title="Colours">
        <div className="row">
          <ColorField label="Text" value={fg} onChange={setFg} />
          <button className="btn" onClick={() => { setFg(bg); setBg(fg); }} title="Swap" aria-label="Swap colours"><ArrowLeftRight size={15} /></button>
          <ColorField label="Background" value={bg} onChange={setBg} />
        </div>
        {a && b && (
          <div className="ct-preview" style={{ color: toHex(a), background: toHex(b) }}>
            <p className="ct-preview__big">Large heading text</p>
            <p>Body text at 16px. The quick brown fox jumps over the lazy dog, and the price is Rs. 12,500.</p>
            <p className="ct-preview__small">Small print at 13px — terms and conditions apply.</p>
            <span className="ct-preview__btn" style={{ borderColor: toHex(a) }}>Button</span>
          </div>
        )}
      </Panel>
      <Panel title="WCAG 2.2 result">
        <div className="ct-ratio">
          <span className={`ct-ratio__num ${ratio >= 4.5 ? "t-add" : ratio >= 3 ? "t-mod" : "t-rem"}`}>{ratio ? ratio.toFixed(2) : "—"}</span>
          <span className="muted">: 1 contrast</span>
        </div>
        <div className="grades">
          <Grade ok={ratio >= 4.5} label="AA body text" need="4.5:1" />
          <Grade ok={ratio >= 3} label="AA large text (24px, or 19px bold)" need="3:1" />
          <Grade ok={ratio >= 3} label="AA icons, borders and inputs" need="3:1" />
          <Grade ok={ratio >= 7} label="AAA body text" need="7:1" />
          <Grade ok={ratio >= 4.5} label="AAA large text" need="4.5:1" />
        </div>
        {(fixAA || fixAAA) && (
          <div className="fixes">
            <span className="fld__label"><Wand2 size={13} style={{ verticalAlign: -2 }} /> Closest text colour that passes</span>
            {fixAA && (
              <button className="fix" onClick={() => setFg(toHex(fixAA))}>
                <span className="swatch" style={{ background: toHex(fixAA) }} /> <code>{toHex(fixAA)}</code> <span className="muted">AA, {contrast(fixAA, b!).toFixed(2)}:1</span>
              </button>
            )}
            {fixAAA && (
              <button className="fix" onClick={() => setFg(toHex(fixAAA))}>
                <span className="swatch" style={{ background: toHex(fixAAA) }} /> <code>{toHex(fixAAA)}</code> <span className="muted">AAA, {contrast(fixAAA, b!).toFixed(2)}:1</span>
              </button>
            )}
          </div>
        )}
      </Panel>
    </Grid>
  );
}

type ExportFmt = "css" | "scss" | "tailwind" | "json";

function PaletteTab({ onUse }: { onUse: (hex: string, as: "fg" | "bg") => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [palette, setPalette] = useState<{ color: RGB; share: number }[]>([]);
  const [fmt, setFmt] = useState<ExportFmt>("css");
  const [busy, setBusy] = useState(false);

  const load = (blob: Blob) => {
    if (img) URL.revokeObjectURL(img);
    setImg(URL.createObjectURL(blob));
  };

  // paste a screenshot straight from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) load(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  useEffect(() => {
    if (!img) return;
    setBusy(true);
    const el = new Image();
    el.onload = () => {
      const max = 160;
      const s = Math.min(1, max / Math.max(el.width, el.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(el.width * s));
      c.height = Math.max(1, Math.round(el.height * s));
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(el, 0, 0, c.width, c.height);
      setPalette(extractPalette(g.getImageData(0, 0, c.width, c.height).data, count));
      setBusy(false);
    };
    el.src = img;
  }, [img, count]);

  const names = palette.map((_, i) => `color-${i + 1}`);
  const exported = useMemo(() => {
    const hex = palette.map((p) => toHex(p.color));
    if (fmt === "css") return `:root {\n${hex.map((h, i) => `  --${names[i]}: ${h};`).join("\n")}\n}\n`;
    if (fmt === "scss") return hex.map((h, i) => `$${names[i]}: ${h};`).join("\n") + "\n";
    if (fmt === "tailwind") return `// tailwind.config.js → theme.extend.colors\nbrand: {\n${hex.map((h, i) => `  ${(i + 1) * 100}: '${h}',`).join("\n")}\n},\n`;
    return JSON.stringify(hex, null, 2) + "\n";
  }, [palette, fmt, names]);

  return (
    <Grid>
      <div className="stack">
        {img ? (
          <Panel title="Screenshot" actions={<button className="btn btn--sm" onClick={() => { setImg(null); setPalette([]); }}>Use another image</button>}>
            <img src={img} alt="Uploaded screenshot" className="pal-img" />
          </Panel>
        ) : (
          <FileDrop accept="image/*" label="Drop a screenshot, or paste one with Ctrl + V" hint="PNG, JPG or WebP. Processed in this tab." icon={<ImagePlus size={26} />} onFiles={([f]) => load(f)} />
        )}
        {img && (
          <Panel title="Colours to find">
            <input type="range" min={3} max={16} value={count} onChange={(e) => setCount(+e.target.value)} className="range" aria-label="Number of colours" />
            <span className="help">{count} colours{busy ? " — working…" : ""}</span>
          </Panel>
        )}
      </div>
      <Panel title="Palette">
        {!palette.length ? (
          <Empty title="No image yet">Upload a design, website screenshot or logo to pull its main colours.</Empty>
        ) : (
          <>
            <div className="pal-bar" aria-hidden="true">
              {palette.map((p, i) => <i key={i} style={{ flex: p.share, background: toHex(p.color) }} />)}
            </div>
            <ul className="pal-list">
              {palette.map((p, i) => {
                const hex = toHex(p.color);
                const [h, s, l] = rgbToHsl(p.color);
                return (
                  <li key={i}>
                    <span className="swatch swatch--lg" style={{ background: hex }} />
                    <span className="pal-list__text">
                      <code>{hex}</code>
                      <span className="muted">rgb({p.color.join(", ")})&ensp;hsl({Math.round(h)} {Math.round(s * 100)}% {Math.round(l * 100)}%)</span>
                    </span>
                    <span className="muted num">{Math.round(p.share * 100)}%</span>
                    <CopyButton text={hex} label="" />
                    <button className="btn btn--ghost btn--sm" onClick={() => onUse(hex, "fg")} title="Check as text colour">Text</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => onUse(hex, "bg")} title="Check as background">Bg</button>
                  </li>
                );
              })}
            </ul>
            <Segmented label="Export format" value={fmt} onChange={setFmt} options={[["css", "CSS variables"], ["scss", "SCSS"], ["tailwind", "Tailwind"], ["json", "JSON"]]} />
            <Output value={exported} />
          </>
        )}
      </Panel>
    </Grid>
  );
}

export function Colors() {
  const [tab, setTab] = useState<"contrast" | "palette">("contrast");
  const [fg, setFg] = useStored("den.colors.fg", "#7b7298");
  const [bg, setBg] = useStored("den.colors.bg", "#120f1c");
  return (
    <ToolFrame slug="colors">
      <Tabs value={tab} onChange={setTab} tabs={[["contrast", "Contrast checker"], ["palette", "Palette from screenshot"]]} />
      {tab === "contrast" && <ContrastTab fg={fg} bg={bg} setFg={setFg} setBg={setBg} />}
      {tab === "palette" && <PaletteTab onUse={(hex, as) => { if (as === "fg") setFg(hex); else setBg(hex); setTab("contrast"); }} />}
    </ToolFrame>
  );
}
