"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, FileDrop, Grid, Notice, Panel, Select, Stat, downloadText } from "../ui";
import { convert, DEFAULT_MAP, type MapOptions, type Row } from "@/lib/shopify";

export function ShopifyToWoo() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<MapOptions>(DEFAULT_MAP);
  const [preview, setPreview] = useState(25);

  const load = (f: File) => {
    setError(null);
    setFileName(f.name);
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        if (!fields.includes("Handle")) {
          setError(`${f.name} doesn't have a Handle column. Export from Shopify admin → Products → Export → "All products" as a CSV for Excel or plain CSV.`);
          setRows(null);
          return;
        }
        setCols(fields);
        setRows(res.data);
        setMap((m) => ({
          ...m,
          categories: fields.includes(m.categories) ? m.categories : fields.includes("Product Category") ? "Product Category" : "",
        }));
      },
      error: (e) => setError(e.message),
    });
  };

  const result = useMemo(() => (rows ? convert(rows, map) : null), [rows, map]);
  const colOptions: [string, string][] = [["", "Leave empty"], ...cols.map((c) => [c, c] as [string, string])];
  const set = (patch: Partial<MapOptions>) => setMap((m) => ({ ...m, ...patch }));

  return (
    <ToolFrame slug="shopify-to-woo" wide>
      {!rows && (
        <FileDrop
          accept=".csv,text/csv"
          label="Drop your Shopify products_export.csv"
          hint="Shopify admin → Products → Export. Everything is converted in this tab."
          icon={<FileSpreadsheet size={26} />}
          onFiles={([f]) => load(f)}
        />
      )}
      {error && <div style={{ marginTop: 14 }}><Notice tone="error">{error}</Notice></div>}

      {rows && result && (
        <div className="stack">
          <div className="sw-head">
            <div className="kvs">
              <Stat label="products" value={result.stats.products} />
              <Stat label="simple" value={result.stats.simple} />
              <Stat label="variable" value={result.stats.variable} tone="mod" />
              <Stat label="variations" value={result.stats.variations} tone="move" />
              <Stat label="images" value={result.stats.images} />
              {result.stats.skipped > 0 && <Stat label="skipped drafts" value={result.stats.skipped} tone="rem" />}
            </div>
            <div className="row" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 13.5 }}>{fileName} ({rows.length} rows)</span>
              <button className="btn btn--sm" onClick={() => { setRows(null); setFileName(""); }}>Use another file</button>
              <button
                className="btn btn--lantern"
                disabled={!result.rows.length}
                onClick={() => downloadText("woocommerce-products.csv", "﻿" + Papa.unparse({ fields: result.columns, data: result.rows.map((r) => result.columns.map((c) => r[c])) }), "text/csv")}
              >
                <Download size={16} /> Download WooCommerce CSV
              </button>
            </div>
          </div>

          <Grid>
            <Panel title="Column mapping">
              <div className="row">
                <Select label="Product name" value={map.name} onChange={(e) => set({ name: e.target.value })} options={colOptions} />
                <Select label="Description" value={map.description} onChange={(e) => set({ description: e.target.value })} options={colOptions} />
              </div>
              <div className="row">
                <Select label="Short description" value={map.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} options={colOptions} />
                <Select label="Categories from" value={map.categories} onChange={(e) => set({ categories: e.target.value })} options={colOptions} hint="Shopify “A > B” paths become nested categories" />
              </div>
              <div className="row">
                <Select label="Tags from" value={map.tags} onChange={(e) => set({ tags: e.target.value })} options={colOptions} />
                <Select label="Vendor becomes" value={map.brand} onChange={(e) => set({ brand: e.target.value as MapOptions["brand"] })}
                  options={[["brands", "Brand (WooCommerce 9.6+ Brands)"], ["tag", "A product tag"], ["category", "A category under Brands"], ["none", "Ignore vendor"]]} />
              </div>
              <div className="row">
                <Select label="SEO title & description" value={map.seo} onChange={(e) => set({ seo: e.target.value as MapOptions["seo"] })}
                  options={[["none", "Don't import"], ["yoast", "Yoast SEO fields"], ["rankmath", "Rank Math fields"]]} />
                <Select label="Weight unit" value={map.weightUnit} onChange={(e) => set({ weightUnit: e.target.value as MapOptions["weightUnit"] })}
                  options={[["kg", "Kilograms"], ["g", "Grams"], ["lbs", "Pounds"], ["oz", "Ounces"]]} hint="Match WooCommerce → Settings → Products" />
              </div>
              <Check label="Skip draft and archived products" checked={map.onlyActive} onChange={(v) => set({ onlyActive: v })} />
            </Panel>

            <Panel
              title="Extra columns as custom fields"
              actions={<button className="btn btn--sm" onClick={() => set({ extraMeta: [...map.extraMeta, { column: "", key: "" }] })}><Plus size={14} /> Add</button>}
            >
              {map.extraMeta.length === 0 && <p className="help">Carry any other Shopify column (like <code>Cost per item</code> or a metafield) into a WooCommerce custom field.</p>}
              {map.extraMeta.map((m, i) => (
                <div className="row" key={i}>
                  <Select label="Shopify column" value={m.column} options={colOptions} onChange={(e) => set({ extraMeta: map.extraMeta.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)) })} />
                  <div className="fld">
                    <span className="fld__label">Meta key</span>
                    <input className="inp" value={m.key} placeholder="_cost_price" onChange={(e) => set({ extraMeta: map.extraMeta.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/\s+/g, "_") } : x)) })} />
                  </div>
                  <button className="btn btn--ghost" aria-label="Remove" onClick={() => set({ extraMeta: map.extraMeta.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </div>
              ))}
              <Notice tone="info">
                Import in WooCommerce → Products → Import. Tick <strong>Update existing products</strong> only for re-runs. Images are downloaded from Shopify&rsquo;s CDN during import, so keep the Shopify store live until it finishes.
              </Notice>
            </Panel>
          </Grid>

          {result.warnings.length > 0 && (
            <Panel title={`Heads-up (${result.warnings.length})`}>
              <ul className="warn-list">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </Panel>
          )}

          <Panel title={`Preview (${Math.min(preview, result.rows.length)} of ${result.rows.length} rows)`} pad={false}>
            <div className="tbl-wrap sw-table">
              <table className="tbl">
                <thead>
                  <tr>{["Type", "SKU", "Name", "Parent", "Regular price", "Sale price", "Stock", "Categories", "Attribute 1 name", "Attribute 1 value(s)", "Images"].map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, preview).map((r, i) => (
                    <tr key={i} className={`sw-row sw-row--${r.Type}`}>
                      <td><span className={`chip ${r.Type === "variable" ? "tone-change" : r.Type === "variation" ? "tone-move" : "tone-info"}`}>{r.Type}</span></td>
                      <td><code>{r.SKU}</code></td>
                      <td>{r.Name}</td>
                      <td><code>{r.Parent}</code></td>
                      <td className="num">{r["Regular price"]}</td>
                      <td className="num t-add">{r["Sale price"]}</td>
                      <td className="num">{r.Stock}</td>
                      <td>{r.Categories}</td>
                      <td>{r["Attribute 1 name"]}</td>
                      <td>{r["Attribute 1 value(s)"]}</td>
                      <td className="muted">{r.Images ? `${r.Images.split(",").length} image${r.Images.split(",").length > 1 ? "s" : ""}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > preview && (
              <button className="code__more" onClick={() => setPreview((p) => p + 100)}>Show 100 more rows</button>
            )}
          </Panel>
        </div>
      )}
    </ToolFrame>
  );
}
