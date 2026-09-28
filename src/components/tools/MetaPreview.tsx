"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Globe, MoreVertical } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Notice, Output, Panel, Segmented, Select, TextArea, TextInput } from "../ui";
import { fetchPage, normaliseUrl, readMeta } from "@/lib/web";

let ctx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  if (typeof document === "undefined") return 0;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  ctx!.font = font;
  return ctx!.measureText(text).width;
}

/** Truncate to a pixel width the way Google does (with an ellipsis). */
function fit(text: string, px: number, font: string): { text: string; cut: boolean } {
  if (textWidth(text, font) <= px) return { text, cut: false };
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(text.slice(0, mid) + " ...", font) <= px) lo = mid;
    else hi = mid - 1;
  }
  return { text: text.slice(0, lo).replace(/\s+\S*$/, "") + " ...", cut: true };
}

function Meter({ value, good, max, unit }: { value: number; good: [number, number]; max: number; unit: string }) {
  const tone = value === 0 ? "rem" : value < good[0] ? "mod" : value <= good[1] ? "add" : "rem";
  return (
    <div className={`meter meter--${tone}`}>
      <div className="meter__bar"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /><b style={{ left: `${(good[0] / max) * 100}%`, width: `${((good[1] - good[0]) / max) * 100}%` }} /></div>
      <span>{Math.round(value)} {unit}</span>
    </div>
  );
}

export function MetaPreview() {
  const [url, setUrl] = useState("");
  const [f, setF] = useState({
    title: "Oud Noir Eau de Parfum | Fragrance Vault",
    description: "A deep, smoky oud with rose and saffron. Long-lasting eau de parfum, delivered island-wide in Sri Lanka within 2 days.",
    siteName: "Fragrance Vault",
    pageUrl: "https://fragrancevault.lk/product/oud-noir/",
    image: "",
    imageAlt: "",
    type: "product",
    card: "summary_large_image",
    twitterSite: "",
    locale: "en_US",
    index: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  // pixel widths need a canvas, so they're only measured in the browser
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setImg(null);
    if (!f.image) return;
    const i = new Image();
    i.onload = () => setImg({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => setImg({ w: 0, h: 0 });
    i.src = f.image;
  }, [f.image]);

  const load = async () => {
    const u = normaliseUrl(url);
    if (!u) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(u);
      const m = readMeta(page.html, page.url);
      setF((x) => ({
        ...x,
        title: m.og.title || m.title || x.title,
        description: m.description || m.og.description || "",
        siteName: m.og.site_name || new URL(page.url).hostname.replace(/^www\./, ""),
        pageUrl: m.canonical || m.og.url || page.url,
        image: m.og.image || m.twitter.image || "",
        imageAlt: m.og["image:alt"] || "",
        type: m.og.type || "website",
        card: m.twitter.card || "summary_large_image",
        twitterSite: m.twitter.site || "",
        locale: m.og.locale || "en_US",
        index: !/noindex/i.test(m.robots),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that page.");
    } finally {
      setLoading(false);
    }
  };

  const host = useMemo(() => { try { return new URL(f.pageUrl).hostname.replace(/^www\./, ""); } catch { return "example.com"; } }, [f.pageUrl]);
  const crumbs = useMemo(() => { try { const u = new URL(f.pageUrl); return [u.hostname, ...u.pathname.split("/").filter(Boolean)].join(" › "); } catch { return f.pageUrl; } }, [f.pageUrl]);
  const titlePx = mounted ? textWidth(f.title, "20px Arial") : 0;
  const gTitle = mounted ? fit(f.title, view === "desktop" ? 580 : 520, "20px Arial") : { text: f.title, cut: false };
  const gDesc = f.description.length > (view === "desktop" ? 158 : 120) ? f.description.slice(0, view === "desktop" ? 155 : 117).replace(/\s+\S*$/, "") + " ..." : f.description;

  const warnings: string[] = [];
  if (!f.title) warnings.push("Missing title.");
  if (mounted && titlePx > 580) warnings.push(`Title is ${Math.round(titlePx)}px wide — Google cuts it around 580px.`);
  if (f.title.length < 25) warnings.push("Title is short. Include the main keyword and brand.");
  if (!f.description) warnings.push("Missing meta description — Google will pick text from the page.");
  else if (f.description.length > 160) warnings.push(`Description is ${f.description.length} characters; around 150–160 shows in full.`);
  else if (f.description.length < 70) warnings.push("Description is short — use the space to sell the click.");
  if (!f.image) warnings.push("No og:image — Facebook, WhatsApp and LinkedIn will show a plain link or guess an image.");
  else if (img && img.w === 0) warnings.push("The image URL didn't load. Use an absolute https:// URL that's publicly reachable.");
  else if (img && (img.w < 1200 || img.h < 630) && f.card === "summary_large_image") warnings.push(`Image is ${img.w}×${img.h}. Use at least 1200×630 for large previews.`);
  if (!f.index) warnings.push("noindex is set — this page won't appear in Google at all.");

  const tags = [
    `<title>${esc(f.title)}</title>`,
    `<meta name="description" content="${esc(f.description)}">`,
    `<link rel="canonical" href="${esc(f.pageUrl)}">`,
    ...(f.index ? [] : [`<meta name="robots" content="noindex, follow">`]),
    "",
    `<!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->`,
    `<meta property="og:type" content="${esc(f.type)}">`,
    `<meta property="og:title" content="${esc(f.title)}">`,
    `<meta property="og:description" content="${esc(f.description)}">`,
    `<meta property="og:url" content="${esc(f.pageUrl)}">`,
    `<meta property="og:site_name" content="${esc(f.siteName)}">`,
    `<meta property="og:locale" content="${esc(f.locale)}">`,
    ...(f.image ? [`<meta property="og:image" content="${esc(f.image)}">`, ...(img?.w ? [`<meta property="og:image:width" content="${img.w}">`, `<meta property="og:image:height" content="${img.h}">`] : []), ...(f.imageAlt ? [`<meta property="og:image:alt" content="${esc(f.imageAlt)}">`] : [])] : []),
    "",
    `<!-- X / Twitter -->`,
    `<meta name="twitter:card" content="${f.card}">`,
    ...(f.twitterSite ? [`<meta name="twitter:site" content="${esc(f.twitterSite)}">`] : []),
    `<meta name="twitter:title" content="${esc(f.title)}">`,
    `<meta name="twitter:description" content="${esc(f.description)}">`,
    ...(f.image ? [`<meta name="twitter:image" content="${esc(f.image)}">`] : []),
  ].join("\n");

  return (
    <ToolFrame slug="meta-preview" wide>
      <form className="bp-url" style={{ marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Load the tags from a live page (optional) — https://example.com/page" aria-label="Page URL" />
        <button className="btn btn--lantern" type="submit" disabled={loading || !url.trim()}><Globe size={15} /> {loading ? "Loading…" : "Fetch tags"}</button>
      </form>
      {error && <div style={{ marginBottom: 16 }}><Notice tone="error">{error}</Notice></div>}

      <Grid>
        <div className="stack">
          <Panel title="Page details">
            <TextInput label={<>Title <span className="muted">({f.title.length} chars, {Math.round(titlePx)} of ~580px)</span></>} value={f.title} onChange={(e) => set({ title: e.target.value })} />
            <Meter value={titlePx} good={[300, 580]} max={700} unit="px" />
            <TextArea label={<>Meta description <span className="muted">({f.description.length} chars)</span></>} rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />
            <Meter value={f.description.length} good={[120, 160]} max={200} unit="chars" />
            <TextInput label="Canonical URL" value={f.pageUrl} onChange={(e) => set({ pageUrl: e.target.value })} />
            <div className="row">
              <TextInput label="Site name" value={f.siteName} onChange={(e) => set({ siteName: e.target.value })} />
              <Select label="og:type" value={f.type} onChange={(e) => set({ type: e.target.value })} options={["website", "article", "product", "profile", "book", "video.other"]} />
            </div>
            <TextInput label="Share image URL (og:image)" value={f.image} placeholder="https://example.com/wp-content/uploads/share.jpg" onChange={(e) => set({ image: e.target.value })} hint={img?.w ? `${img.w}×${img.h}px` : "1200×630px works everywhere"} />
            <TextInput label="Image alt text" value={f.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} />
            <div className="row">
              <Select label="X card" value={f.card} onChange={(e) => set({ card: e.target.value })} options={[["summary_large_image", "Large image"], ["summary", "Small square"]]} />
              <TextInput label="X handle" value={f.twitterSite} placeholder="@brand" onChange={(e) => set({ twitterSite: e.target.value })} />
              <Select label="Locale" value={f.locale} onChange={(e) => set({ locale: e.target.value })} options={["en_US", "en_GB", "si_LK", "ta_LK", "fi_FI", "de_DE", "fr_FR"]} />
            </div>
            <Check label="Allow search engines to index this page" checked={f.index} onChange={(v) => set({ index: v })} />
          </Panel>
          {warnings.length > 0 && (
            <Panel title="Suggestions">
              <ul className="warn-list">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="Google" actions={<Segmented label="Device" value={view} onChange={setView} options={[["desktop", "Desktop"], ["mobile", "Mobile"]]} />}>
            <div className={`serp serp--${view}`}>
              <div className="serp__site">
                <span className="serp__fav">{f.siteName.slice(0, 1).toUpperCase()}</span>
                <span><span className="serp__name">{f.siteName || host}</span><span className="serp__crumbs">{crumbs}</span></span>
                <MoreVertical size={14} className="serp__more" />
              </div>
              <div className="serp__title">{gTitle.text || "Untitled page"}</div>
              <div className="serp__desc">{gDesc || <em>Google will show a snippet from the page.</em>}</div>
            </div>
          </Panel>

          <Panel title="Facebook & LinkedIn">
            <div className="fb">
              {f.image ? <div className="fb__img" style={{ backgroundImage: `url("${f.image}")` }} /> : <div className="fb__img fb__img--none">No image</div>}
              <div className="fb__body">
                <span className="fb__host">{host.toUpperCase()}</span>
                <span className="fb__title">{f.title}</span>
                <span className="fb__desc">{f.description}</span>
              </div>
            </div>
          </Panel>

          <Grid>
            <Panel title="WhatsApp">
              <div className="wa">
                <div className="wa__bubble">
                  <div className="wa__card">
                    {f.image && <div className="wa__img" style={{ backgroundImage: `url("${f.image}")` }} />}
                    <div className="wa__text">
                      <span className="wa__title">{f.title}</span>
                      <span className="wa__desc">{f.description}</span>
                      <span className="wa__host">{host}</span>
                    </div>
                  </div>
                  <span className="wa__link">{f.pageUrl}</span>
                  <span className="wa__time">10:24 ✓✓</span>
                </div>
              </div>
            </Panel>
            <Panel title="X">
              <div className={`xc xc--${f.card === "summary" ? "small" : "large"}`}>
                {f.image ? <div className="xc__img" style={{ backgroundImage: `url("${f.image}")` }} /> : <div className="xc__img xc__img--none" />}
                <div className="xc__body">
                  {f.card === "summary" ? (<><span className="xc__host">{host}</span><span className="xc__title">{f.title}</span><span className="xc__desc">{f.description}</span></>) : <span className="xc__over">{host}</span>}
                </div>
              </div>
              {f.card !== "summary" && <span className="muted" style={{ fontSize: 12.5 }}>From {host}</span>}
            </Panel>
          </Grid>

          <Panel title="Meta tags" actions={<button className="btn btn--ghost btn--sm" onClick={() => { const b = new Blob([tags], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "meta-tags.html"; a.click(); }}><Download size={14} /> Download</button>}>
            <Output value={tags} maxHeight={360} />
            <p className="help">On WordPress, set these in Yoast or Rank Math rather than pasting them into the theme. After changing a share image, refresh Facebook&rsquo;s cache in the Sharing Debugger.</p>
          </Panel>
        </div>
      </Grid>
    </ToolFrame>
  );
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
