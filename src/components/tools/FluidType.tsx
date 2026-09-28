"use client";

import { useMemo, useState } from "react";
import { ToolFrame } from "../ToolFrame";
import { Grid, Output, Panel, Select, Tabs, TextInput } from "../ui";
import { CopyButton } from "../CopyButton";
import { useStored } from "@/lib/store";

const r4 = (n: number) => Math.round(n * 10000) / 10000;

function clampClean(minPx: number, maxPx: number, minVw: number, maxVw: number, root: number): string {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const lo = Math.min(minPx, maxPx) / root, hi = Math.max(minPx, maxPx) / root;
  const i = r4(intercept / root);
  const s = r4(slope * 100);
  const mid = i === 0 ? `${s}vw` : `${i}rem ${s >= 0 ? "+" : "-"} ${Math.abs(s)}vw`;
  return `clamp(${r4(lo)}rem, ${mid}, ${r4(hi)}rem)`;
}

function sizeAt(minPx: number, maxPx: number, minVw: number, maxVw: number, vw: number): number {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const v = minPx + slope * (vw - minVw);
  return Math.min(Math.max(v, Math.min(minPx, maxPx)), Math.max(minPx, maxPx));
}

const RATIOS: [string, string][] = [
  ["1.067", "Minor second 1.067"], ["1.125", "Major second 1.125"], ["1.2", "Minor third 1.2"], ["1.25", "Major third 1.25"],
  ["1.333", "Perfect fourth 1.333"], ["1.414", "Augmented fourth 1.414"], ["1.5", "Perfect fifth 1.5"], ["1.618", "Golden ratio 1.618"],
];

function ClampTab() {
  const [v, setV] = useStored("den.fluid.clamp", { min: "16", max: "24", minVw: "375", maxVw: "1440", root: "16", prop: "font-size" });
  const [preview, setPreview] = useState(900);
  const n = { min: +v.min || 0, max: +v.max || 0, minVw: +v.minVw || 320, maxVw: +v.maxVw || 1440, root: +v.root || 16 };
  const valid = n.maxVw > n.minVw;
  const value = valid ? clampClean(n.min, n.max, n.minVw, n.maxVw, n.root) : "";
  const now = sizeAt(n.min, n.max, n.minVw, n.maxVw, preview);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });

  return (
    <Grid>
      <Panel title="Values">
        <div className="row">
          <TextInput label="Size at small screens (px)" inputMode="decimal" value={v.min} onChange={(e) => set({ min: e.target.value })} />
          <TextInput label="Size at large screens (px)" inputMode="decimal" value={v.max} onChange={(e) => set({ max: e.target.value })} />
        </div>
        <div className="row">
          <TextInput label="Small viewport (px)" inputMode="numeric" value={v.minVw} onChange={(e) => set({ minVw: e.target.value })} />
          <TextInput label="Large viewport (px)" inputMode="numeric" value={v.maxVw} onChange={(e) => set({ maxVw: e.target.value })} />
          <TextInput label="Root font size" inputMode="numeric" value={v.root} onChange={(e) => set({ root: e.target.value })} />
        </div>
        <Select label="CSS property" value={v.prop} onChange={(e) => set({ prop: e.target.value })} options={["font-size", "padding", "margin", "gap", "width", "--space"]} />
        <p className="help">Works for spacing too — try padding from 16px to 64px. Using rem keeps text zoomable (WCAG 1.4.4).</p>
      </Panel>
      <Panel title="Result">
        {valid ? (
          <>
            <div className="clamp-value">
              <code>{value}</code>
              <CopyButton text={value} />
            </div>
            <Output value={`${v.prop}: ${value};`} label="CSS" />
            <div className="fld">
              <span className="fld__label">Preview at {preview}px wide: {Math.round(now * 10) / 10}px</span>
              <input type="range" min={Math.min(320, n.minVw)} max={Math.max(1920, n.maxVw)} value={preview} onChange={(e) => setPreview(+e.target.value)} className="range" />
            </div>
            {v.prop === "font-size" && <p className="clamp-sample" style={{ fontSize: now }}>The quick brown fox</p>}
          </>
        ) : (
          <p className="help">The large viewport must be wider than the small one.</p>
        )}
      </Panel>
    </Grid>
  );
}

function ScaleTab() {
  const [v, setV] = useStored("den.fluid.scale", { minBase: "16", maxBase: "20", minRatio: "1.2", maxRatio: "1.25", minVw: "375", maxVw: "1440", steps: "6", neg: "2", prefix: "step" });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const root = 16;
  const rows = useMemo(() => {
    const out: { step: number; min: number; max: number; css: string }[] = [];
    for (let s = -(+v.neg || 0); s <= (+v.steps || 0); s++) {
      const min = (+v.minBase || 16) * Math.pow(+v.minRatio || 1.2, s);
      const max = (+v.maxBase || 20) * Math.pow(+v.maxRatio || 1.25, s);
      out.push({ step: s, min, max, css: clampClean(min, max, +v.minVw || 375, +v.maxVw || 1440, root) });
    }
    return out;
  }, [v]);
  const css = `:root {\n${rows.map((r) => `  --${v.prefix}-${r.step < 0 ? `n${-r.step}` : r.step}: ${r.css};`).join("\n")}\n}\n`;

  return (
    <Grid>
      <Panel title="Scale">
        <div className="row">
          <TextInput label="Base size, small (px)" value={v.minBase} onChange={(e) => set({ minBase: e.target.value })} />
          <TextInput label="Base size, large (px)" value={v.maxBase} onChange={(e) => set({ maxBase: e.target.value })} />
        </div>
        <div className="row">
          <Select label="Ratio, small screens" value={v.minRatio} onChange={(e) => set({ minRatio: e.target.value })} options={RATIOS} />
          <Select label="Ratio, large screens" value={v.maxRatio} onChange={(e) => set({ maxRatio: e.target.value })} options={RATIOS} />
        </div>
        <div className="row">
          <TextInput label="Small viewport" value={v.minVw} onChange={(e) => set({ minVw: e.target.value })} />
          <TextInput label="Large viewport" value={v.maxVw} onChange={(e) => set({ maxVw: e.target.value })} />
          <TextInput label="Steps up" value={v.steps} onChange={(e) => set({ steps: e.target.value })} />
          <TextInput label="Steps down" value={v.neg} onChange={(e) => set({ neg: e.target.value })} />
        </div>
        <Output value={css} label="CSS custom properties" filename="type-scale.css" />
      </Panel>
      <Panel title="Preview" pad={false}>
        <div className="scale-list">
          {[...rows].reverse().map((r) => (
            <div key={r.step} className="scale-row">
              <span className="scale-row__meta"><code>--{v.prefix}-{r.step < 0 ? `n${-r.step}` : r.step}</code><span className="muted">{Math.round(r.min)}–{Math.round(r.max)}px</span></span>
              <span className="scale-row__sample" style={{ fontSize: `min(${r.max}px, ${r.css})` }}>Aa Fragrance</span>
            </div>
          ))}
        </div>
      </Panel>
    </Grid>
  );
}

function UnitsTab() {
  const [root, setRoot] = useStored("den.fluid.root", "16");
  const [px, setPx] = useState("24");
  const [rem, setRem] = useState("1.5");
  const base = +root || 16;
  const common = [4, 8, 10, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120];
  return (
    <Grid>
      <Panel title="Convert">
        <TextInput label="Root font size (px)" value={root} onChange={(e) => setRoot(e.target.value)} hint="Browsers default to 16px" />
        <div className="row">
          <TextInput label="Pixels" value={px} inputMode="decimal" onChange={(e) => { setPx(e.target.value); const n = parseFloat(e.target.value); setRem(isFinite(n) ? String(r4(n / base)) : ""); }} />
          <TextInput label="rem / em" value={rem} inputMode="decimal" onChange={(e) => { setRem(e.target.value); const n = parseFloat(e.target.value); setPx(isFinite(n) ? String(r4(n * base)) : ""); }} />
        </div>
        <div className="clamp-value">
          <code>{px || 0}px = {rem || 0}rem</code>
          <CopyButton text={`${rem}rem`} label="Copy rem" />
        </div>
        <p className="help">em is relative to the parent element&rsquo;s font size, rem to the root. Both give the same number when the parent inherits the root size.</p>
      </Panel>
      <Panel title={`Common sizes at ${base}px root`} pad={false}>
        <div className="tbl-wrap" style={{ border: 0, maxHeight: 520, overflow: "auto" }}>
          <table className="tbl">
            <thead><tr><th className="num">px</th><th className="num">rem</th><th>Tailwind</th><th /></tr></thead>
            <tbody>
              {common.map((p) => (
                <tr key={p}>
                  <td className="num">{p}</td>
                  <td className="num"><code>{r4(p / base)}rem</code></td>
                  <td className="muted">{p % 4 === 0 ? `${p / 4}` : "—"}</td>
                  <td><CopyButton text={`${r4(p / base)}rem`} label="" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Grid>
  );
}

export function FluidType() {
  const [tab, setTab] = useState<"clamp" | "scale" | "units">("clamp");
  return (
    <ToolFrame slug="fluid-type">
      <Tabs value={tab} onChange={setTab} tabs={[["clamp", "clamp() calculator"], ["scale", "Fluid type scale"], ["units", "px ↔ rem"]]} />
      {tab === "clamp" && <ClampTab />}
      {tab === "scale" && <ScaleTab />}
      {tab === "units" && <UnitsTab />}
    </ToolFrame>
  );
}
