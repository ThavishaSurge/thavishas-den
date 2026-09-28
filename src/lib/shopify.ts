/* Shopify product export → WooCommerce product CSV importer format. */

export type Row = Record<string, string>;

export interface MapOptions {
  name: string;
  description: string;
  shortDescription: string;
  categories: string;
  tags: string;
  /** How Vendor is carried over. */
  brand: "none" | "brands" | "tag" | "category";
  seo: "none" | "yoast" | "rankmath";
  weightUnit: "kg" | "g" | "lbs" | "oz";
  onlyActive: boolean;
  extraMeta: { column: string; key: string }[];
}

export const DEFAULT_MAP: MapOptions = {
  name: "Title",
  description: "Body (HTML)",
  shortDescription: "",
  categories: "Type",
  tags: "Tags",
  brand: "brands",
  seo: "none",
  weightUnit: "kg",
  onlyActive: false,
  extraMeta: [],
};

export interface ConvertResult {
  rows: Row[];
  columns: string[];
  stats: { products: number; simple: number; variable: number; variations: number; images: number; skipped: number };
  warnings: string[];
}

const val = (r: Row, col: string) => (col ? (r[col] ?? "").trim() : "");
const truthy = (s: string) => /^(true|yes|1|active)$/i.test(s.trim());

function weight(grams: string, unit: MapOptions["weightUnit"]): string {
  const g = parseFloat(grams);
  if (!isFinite(g) || g <= 0) return "";
  const v = unit === "kg" ? g / 1000 : unit === "g" ? g : unit === "lbs" ? g / 453.592 : g / 28.3495;
  return String(Math.round(v * 1000) / 1000);
}

function prices(price: string, compareAt: string): { regular: string; sale: string } {
  const p = parseFloat(price);
  const c = parseFloat(compareAt);
  if (isFinite(c) && isFinite(p) && c > p) return { regular: String(c), sale: String(p) };
  return { regular: isFinite(p) ? String(p) : "", sale: "" };
}

function category(raw: string, col: string): string {
  if (!raw) return "";
  // Shopify's standard taxonomy uses " > " already; Woo uses the same separator for hierarchy.
  if (col === "Tags") return raw.split(",").map((t) => t.trim()).filter(Boolean).join(", ");
  return raw.replace(/\s*>\s*/g, " > ");
}

export function convert(input: Row[], o: MapOptions): ConvertResult {
  const warnings: string[] = [];
  const groups = new Map<string, Row[]>();
  for (const r of input) {
    const h = val(r, "Handle");
    if (!h) continue;
    groups.set(h, [...(groups.get(h) ?? []), r]);
  }
  if (!groups.size) {
    return { rows: [], columns: [], stats: { products: 0, simple: 0, variable: 0, variations: 0, images: 0, skipped: 0 }, warnings: ["No rows with a Handle column. Is this a Shopify products export?"] };
  }

  const out: Row[] = [];
  const stats = { products: 0, simple: 0, variable: 0, variations: 0, images: 0, skipped: 0 };
  const seenSku = new Set<string>();
  let maxAttrs = 0;

  for (const [handle, rows] of groups) {
    const first = rows[0];
    const status = val(first, "Status");
    const published = status ? status.toLowerCase() === "active" : truthy(val(first, "Published") || "true");
    if (o.onlyActive && !published) { stats.skipped++; continue; }

    const optionNames = [1, 2, 3].map((i) => val(first, `Option${i} Name`)).filter((n) => n && n !== "Title");
    const variantRows = rows.filter((r) => val(r, "Variant Price") !== "" || val(r, "Variant SKU") !== "" || val(r, "Option1 Value") !== "");
    const isSimple = optionNames.length === 0 || (variantRows.length <= 1 && val(first, "Option1 Value") === "Default Title");

    const images = [...new Set(
      rows
        .map((r) => [val(r, "Image Src"), val(r, "Image Position")] as const)
        .filter(([src]) => src)
        .sort((a, b) => (parseInt(a[1]) || 999) - (parseInt(b[1]) || 999))
        .map(([src]) => src),
    )];
    stats.images += images.length;

    const vendor = val(first, "Vendor");
    const tagsSrc = category(val(first, o.tags), "Tags");
    const tags = [tagsSrc, o.brand === "tag" && vendor ? vendor : ""].filter(Boolean).join(", ");
    const cats = [category(val(first, o.categories), o.categories), o.brand === "category" && vendor ? `Brands > ${vendor}` : ""].filter(Boolean).join(", ");

    const base: Row = {
      Name: val(first, o.name),
      Published: published ? "1" : "-1",
      "Is featured?": "0",
      "Visibility in catalog": "visible",
      "Short description": o.shortDescription ? val(first, o.shortDescription) : "",
      Description: val(first, o.description),
      Categories: cats,
      Tags: tags,
      Images: images.join(", "),
    };
    if (o.brand === "brands" && vendor) base.Brands = vendor;
    if (o.seo !== "none") {
      const t = val(first, "SEO Title"), d = val(first, "SEO Description");
      if (o.seo === "yoast") { base["Meta: _yoast_wpseo_title"] = t; base["Meta: _yoast_wpseo_metadesc"] = d; }
      else { base["Meta: rank_math_title"] = t; base["Meta: rank_math_description"] = d; }
    }
    for (const m of o.extraMeta) if (m.column && m.key) base[`Meta: ${m.key}`] = val(first, m.column);

    const attrs: { name: string; values: string[]; variation: boolean }[] = [];
    if (!isSimple) {
      optionNames.forEach((n, i) => {
        const values = [...new Set(variantRows.map((r) => val(r, `Option${i + 1} Value`)).filter(Boolean))];
        attrs.push({ name: n, values, variation: true });
      });
    }
    maxAttrs = Math.max(maxAttrs, attrs.length);

    const setAttrs = (row: Row, list: { name: string; values: string[]; variation: boolean }[], forVariation: boolean) => {
      list.forEach((a, i) => {
        row[`Attribute ${i + 1} name`] = a.name;
        row[`Attribute ${i + 1} value(s)`] = a.values.join(", ");
        row[`Attribute ${i + 1} global`] = "1";
        if (!forVariation) row[`Attribute ${i + 1} visible`] = "1";
      });
    };

    const stockFor = (r: Row): Partial<Row> => {
      const tracked = val(r, "Variant Inventory Tracker").toLowerCase() === "shopify";
      const qty = val(r, "Variant Inventory Qty");
      return {
        "Manage stock?": tracked ? "1" : "0",
        Stock: tracked ? qty || "0" : "",
        "In stock?": tracked ? (parseInt(qty || "0") > 0 || val(r, "Variant Inventory Policy") === "continue" ? "1" : "0") : "1",
        "Backorders allowed?": val(r, "Variant Inventory Policy") === "continue" ? "1" : "0",
        "Tax status": val(r, "Variant Taxable") === "" || truthy(val(r, "Variant Taxable")) ? "taxable" : "none",
        [`Weight (${o.weightUnit})`]: weight(val(r, "Variant Grams"), o.weightUnit),
        "GTIN, UPC, EAN, or ISBN": val(r, "Variant Barcode"),
      };
    };

    const uniqueSku = (sku: string, fallback: string) => {
      let s = sku || fallback;
      if (seenSku.has(s)) {
        warnings.push(`Duplicate SKU "${s}" — renamed to keep the import from merging products.`);
        let k = 2;
        while (seenSku.has(`${s}-${k}`)) k++;
        s = `${s}-${k}`;
      }
      seenSku.add(s);
      return s;
    };

    stats.products++;
    if (isSimple) {
      stats.simple++;
      const v = variantRows[0] ?? first;
      const pr = prices(val(v, "Variant Price"), val(v, "Variant Compare At Price"));
      const row: Row = { Type: "simple", SKU: uniqueSku(val(v, "Variant SKU"), handle), ...base, ...stockFor(v), "Regular price": pr.regular, "Sale price": pr.sale } as Row;
      setAttrs(row, attrs, false);
      if (!val(v, "Variant SKU")) warnings.push(`"${base.Name}" has no SKU — used the handle "${handle}".`);
      out.push(row);
      continue;
    }

    stats.variable++;
    const parentSku = uniqueSku(handle, handle);
    const parent: Row = { Type: "variable", SKU: parentSku, ...base, "Tax status": "taxable", "In stock?": "1" };
    setAttrs(parent, attrs, false);
    // default variation = first variant's options
    attrs.forEach((a, i) => { if (a.variation) parent[`Attribute ${i + 1} default`] = val(variantRows[0], `Option${i + 1} Value`); });
    out.push(parent);

    variantRows.forEach((v, idx) => {
      stats.variations++;
      const pr = prices(val(v, "Variant Price"), val(v, "Variant Compare At Price"));
      const values = optionNames.map((_, i) => val(v, `Option${i + 1} Value`));
      const row: Row = {
        Type: "variation",
        SKU: uniqueSku(val(v, "Variant SKU"), `${handle}-${values.map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-") || idx + 1}`),
        Name: `${base.Name} - ${values.join(", ")}`,
        Parent: parentSku,
        Published: "1",
        Images: val(v, "Variant Image"),
        "Regular price": pr.regular,
        "Sale price": pr.sale,
        ...stockFor(v),
      } as Row;
      setAttrs(row, attrs.filter((a) => a.variation).map((a, i) => ({ ...a, values: [values[i]] })), true);
      out.push(row);
    });
  }

  const core = ["Type", "SKU", "Name", "Parent", "Published", "Is featured?", "Visibility in catalog", "Short description", "Description",
    "Tax status", "In stock?", "Manage stock?", "Stock", "Backorders allowed?", `Weight (${o.weightUnit})`, "Sale price", "Regular price",
    "Categories", "Tags", ...(o.brand === "brands" ? ["Brands"] : []), "Images", "GTIN, UPC, EAN, or ISBN"];
  const attrCols: string[] = [];
  for (let i = 1; i <= maxAttrs; i++) attrCols.push(`Attribute ${i} name`, `Attribute ${i} value(s)`, `Attribute ${i} visible`, `Attribute ${i} global`, `Attribute ${i} default`);
  const meta = [...new Set(out.flatMap((r) => Object.keys(r).filter((k) => k.startsWith("Meta: "))))];
  const columns = [...core, ...attrCols, ...meta];
  const rows = out.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? ""])));

  return { rows, columns, stats, warnings: [...new Set(warnings)].slice(0, 30) };
}
