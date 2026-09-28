"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { AppWindow, Download } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, FileDrop, Grid, Output, Panel, TextInput, downloadBlob } from "../ui";
import { buildIco, canvasToPng, iconCanvas, loadImageEl } from "@/lib/images";

interface Pack {
  files: { name: string; blob: Blob; url: string; size?: number }[];
}

export function Favicons() {
  const [src, setSrc] = useState<{ img: HTMLImageElement; file: File } | null>(null);
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [theme, setTheme] = useState("#120f1c");
  const [bg, setBg] = useState("#ffffff");
  const [transparentSmall, setTransparentSmall] = useState(true);
  const [padding, setPadding] = useState(12);
  const [radius, setRadius] = useState(22);
  const [path, setPath] = useState("/");
  const [pack, setPack] = useState<Pack | null>(null);

  const load = async (f: File) => {
    const img = await loadImageEl(f);
    if (!img.naturalWidth) { img.width = 512; img.height = 512; }
    setSrc({ img, file: f });
  };

  useEffect(() => {
    if (!src) return;
    let alive = true;
    (async () => {
      const im = src.img;
      const el = Object.assign(im, { width: im.naturalWidth || 512, height: im.naturalHeight || 512 });
      const small = (size: number) => iconCanvas(el, size, { bg: transparentSmall ? null : bg, padding: 0, radius: transparentSmall ? 0 : radius });
      const app = (size: number, pad = padding) => iconCanvas(el, size, { bg, padding: pad, radius: 0 });
      const out: Pack["files"] = [];
      const add = async (fname: string, c: HTMLCanvasElement) => {
        const blob = await canvasToPng(c);
        out.push({ name: fname, blob, url: URL.createObjectURL(blob), size: c.width });
      };
      await add("favicon-16x16.png", small(16));
      await add("favicon-32x32.png", small(32));
      await add("favicon-48x48.png", small(48));
      await add("apple-touch-icon.png", app(180));
      await add("android-chrome-192x192.png", iconCanvas(el, 192, { bg, padding, radius }));
      await add("android-chrome-512x512.png", iconCanvas(el, 512, { bg, padding, radius }));
      await add("maskable-icon-512x512.png", app(512, Math.max(padding, 20)));
      const ico = await buildIco(out.filter((f) => /favicon-(16|32|48)/.test(f.name)).map((f) => ({ size: f.size!, blob: f.blob })));
      out.unshift({ name: "favicon.ico", blob: ico, url: URL.createObjectURL(ico) });
      if (src.file.type === "image/svg+xml") out.push({ name: "favicon.svg", blob: src.file, url: URL.createObjectURL(src.file) });
      if (alive) setPack((old) => { old?.files.forEach((f) => URL.revokeObjectURL(f.url)); return { files: out }; });
    })();
    return () => { alive = false; };
  }, [src, bg, transparentSmall, padding, radius]);

  const p = path.endsWith("/") ? path : path + "/";
  const manifest = useMemo(() => JSON.stringify({
    name: name || "My Site",
    short_name: short || name || "Site",
    icons: [
      { src: `${p}android-chrome-192x192.png`, sizes: "192x192", type: "image/png" },
      { src: `${p}android-chrome-512x512.png`, sizes: "512x512", type: "image/png" },
      { src: `${p}maskable-icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    theme_color: theme,
    background_color: bg,
    display: "standalone",
    start_url: "/",
  }, null, 2) + "\n", [name, short, theme, bg, p]);

  const hasSvg = src?.file.type === "image/svg+xml";
  const html = [
    `<link rel="icon" href="${p}favicon.ico" sizes="48x48">`,
    hasSvg ? `<link rel="icon" href="${p}favicon.svg" type="image/svg+xml">` : `<link rel="icon" type="image/png" sizes="32x32" href="${p}favicon-32x32.png">`,
    `<link rel="apple-touch-icon" href="${p}apple-touch-icon.png">`,
    `<link rel="manifest" href="${p}site.webmanifest">`,
    `<meta name="theme-color" content="${theme}">`,
  ].join("\n");

  const download = async () => {
    if (!pack) return;
    const zip = new JSZip();
    pack.files.forEach((f) => zip.file(f.name, f.blob));
    zip.file("site.webmanifest", manifest);
    zip.file("favicon-snippet.html", html + "\n");
    downloadBlob("favicons.zip", await zip.generateAsync({ type: "blob" }));
  };

  const file = (n: string) => pack?.files.find((f) => f.name === n)?.url;

  return (
    <ToolFrame slug="favicons">
      <Grid>
        <div className="stack">
          {src ? (
            <Panel title="Source image" actions={<button className="btn btn--sm" onClick={() => { setSrc(null); setPack(null); }}>Use another</button>}>
              <div className="fav-src"><img src={src.img.src} alt="Source logo" /></div>
              <p className="help">{src.img.naturalWidth < 512 && src.file.type !== "image/svg+xml" ? `This image is ${src.img.naturalWidth}px wide — use at least 512px (or an SVG) for sharp app icons.` : "Looks good. A square image works best."}</p>
            </Panel>
          ) : (
            <FileDrop accept="image/png,image/svg+xml,image/jpeg,image/webp" label="Drop your logo or icon" hint="Square SVG or PNG, 512px or larger" icon={<AppWindow size={26} />} onFiles={([f]) => load(f)} />
          )}
          <Panel title="Settings">
            <div className="row">
              <TextInput label="Site name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fragrance Vault" />
              <TextInput label="Short name" value={short} onChange={(e) => setShort(e.target.value)} placeholder="Vault" hint="Under the home-screen icon" />
            </div>
            <div className="row">
              <div className="fld"><span className="fld__label">Icon background</span><div className="colorfield"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label="Icon background" /><input className="inp inp--code" value={bg} onChange={(e) => setBg(e.target.value)} /></div></div>
              <div className="fld"><span className="fld__label">Theme colour</span><div className="colorfield"><input type="color" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme colour" /><input className="inp inp--code" value={theme} onChange={(e) => setTheme(e.target.value)} /></div></div>
            </div>
            <div className="fld"><span className="fld__label">Padding on app icons: {padding}%</span><input type="range" className="range" min={0} max={30} value={padding} onChange={(e) => setPadding(+e.target.value)} /></div>
            <div className="fld"><span className="fld__label">Corner radius on Android icons: {radius}%</span><input type="range" className="range" min={0} max={50} value={radius} onChange={(e) => setRadius(+e.target.value)} /></div>
            <Check label="Keep small favicons transparent" hint="Browser tabs; turn off if the logo is dark on transparent" checked={transparentSmall} onChange={setTransparentSmall} />
            <TextInput label="Icons folder on the site" value={path} onChange={(e) => setPath(e.target.value)} hint="/ for the site root, or e.g. /wp-content/uploads/icons/" />
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Preview" actions={pack && <button className="btn btn--lantern" onClick={download}><Download size={16} /> Download pack</button>}>
            {pack ? (
              <>
                <div className="fav-tab">
                  <span className="fav-tab__tab"><img src={file("favicon-32x32.png")} alt="" width={16} height={16} /> {name || "My Site"}</span>
                  <span className="fav-tab__tab fav-tab__tab--light"><img src={file("favicon-32x32.png")} alt="" width={16} height={16} /> {name || "My Site"}</span>
                </div>
                <div className="fav-home">
                  <span><img src={file("apple-touch-icon.png")} alt="" className="fav-home__ios" />{short || name || "Site"}</span>
                  <span><img src={file("android-chrome-192x192.png")} alt="" className="fav-home__and" />{short || name || "Site"}</span>
                </div>
                <ul className="fav-files">
                  {pack.files.map((f) => <li key={f.name}><img src={f.url} alt="" /><code>{f.name}</code></li>)}
                  <li><span className="fav-files__doc">{"{}"}</span><code>site.webmanifest</code></li>
                </ul>
              </>
            ) : (
              <p className="help">Upload an image to generate favicon.ico (16, 32 and 48px), PNG favicons, the Apple touch icon, Android and maskable PWA icons, and a web manifest.</p>
            )}
          </Panel>
          <Panel title="Paste into <head>">
            <Output value={html} />
            <p className="help">On WordPress you can instead upload the 512px icon in Appearance → Customize → Site Identity, and only use this for custom themes.</p>
          </Panel>
          {pack && <Panel title="site.webmanifest"><Output value={manifest} /></Panel>}
        </div>
      </Grid>
    </ToolFrame>
  );
}
