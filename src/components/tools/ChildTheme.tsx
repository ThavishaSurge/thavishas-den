"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { Download } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Output, Panel, Select, TextArea, TextInput, Tabs, downloadBlob } from "../ui";

interface Parent {
  id: string;
  name: string;
  template: string;
  block?: boolean;
  /** PHP body for the enqueue function, or null when the parent loads child CSS itself. */
  enqueue: (fn: string, slug: string) => string | null;
  note: string;
}

/**
 * The parent already loads its own CSS, so the child stylesheet is enqueued at priority 20 —
 * after the parent — instead of depending on a handle that could change between versions.
 */
const generic = () => (fn: string, slug: string) => `// Priority 20 loads this after the parent theme's styles.
add_action( 'wp_enqueue_scripts', '${fn}_enqueue_styles', 20 );
function ${fn}_enqueue_styles() {
    wp_enqueue_style(
        '${slug}-style',
        get_stylesheet_uri(),
        array(),
        wp_get_theme()->get( 'Version' )
    );
}`;

const PARENTS: Parent[] = [
  {
    id: "divi", name: "Divi", template: "Divi",
    enqueue: (fn, slug) => `add_action( 'wp_enqueue_scripts', '${fn}_enqueue_styles' );
function ${fn}_enqueue_styles() {
    $theme       = wp_get_theme();
    $parenthandle = 'divi-style';
    wp_enqueue_style( $parenthandle, get_template_directory_uri() . '/style.css', array(), $theme->parent()->get( 'Version' ) );
    wp_enqueue_style( '${slug}-style', get_stylesheet_uri(), array( $parenthandle ), $theme->get( 'Version' ) );
}`,
    note: "Follows Elegant Themes' child theme guide. Divi Builder layouts and Theme Options carry over.",
  },
  { id: "hello", name: "Hello Elementor", template: "hello-elementor", enqueue: generic(), note: "Hello loads its own styles; the child stylesheet loads right after them." },
  { id: "astra", name: "Astra", template: "astra", enqueue: generic(), note: "Astra loads its own CSS; the child stylesheet loads after it so your rules win." },
  { id: "generatepress", name: "GeneratePress", template: "generatepress", enqueue: () => null, note: "GeneratePress enqueues the child style.css automatically, so functions.php starts empty." },
  { id: "kadence", name: "Kadence", template: "kadence", enqueue: generic(), note: "Kadence loads its own CSS; the child stylesheet loads after it." },
  { id: "oceanwp", name: "OceanWP", template: "oceanwp", enqueue: generic(), note: "OceanWP loads its own CSS; the child stylesheet loads after it." },
  { id: "blocksy", name: "Blocksy", template: "blocksy", enqueue: generic(), note: "Blocksy loads its own CSS; the child stylesheet loads after it." },
  { id: "storefront", name: "Storefront", template: "storefront", enqueue: () => null, note: "Storefront loads the child style.css itself (storefront-child-style)." },
  { id: "tt5", name: "Twenty Twenty-Five", template: "twentytwentyfive", block: true, enqueue: (fn, slug) => `add_action( 'wp_enqueue_scripts', '${fn}_enqueue_styles' );
function ${fn}_enqueue_styles() {
    wp_enqueue_style( '${slug}-style', get_stylesheet_uri(), array(), wp_get_theme()->get( 'Version' ) );
}`, note: "Block theme: most styling goes in theme.json. style.css is loaded for any extra CSS." },
  { id: "custom", name: "Another theme…", template: "", enqueue: (fn, slug) => `add_action( 'wp_enqueue_scripts', '${fn}_enqueue_styles' );
function ${fn}_enqueue_styles() {
    $theme = wp_get_theme();
    wp_enqueue_style( 'parent-style', get_template_directory_uri() . '/style.css', array(), $theme->parent()->get( 'Version' ) );
    wp_enqueue_style( '${slug}-style', get_stylesheet_uri(), array( 'parent-style' ), $theme->get( 'Version' ) );
}`, note: "Uses the standard WordPress pattern: load the parent style.css, then the child's." },
];

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function makeScreenshot(title: string, subtitle: string): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 900;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 1200, 900);
  grad.addColorStop(0, "#1a1628");
  grad.addColorStop(1, "#2a2344");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 900);
  const glow = g.createRadialGradient(260, 220, 0, 260, 220, 520);
  glow.addColorStop(0, "rgba(255,170,80,0.35)");
  glow.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 1200, 900);
  g.fillStyle = "#eee9fa";
  g.font = "800 96px system-ui, sans-serif";
  const words = title.split(" ");
  let line = "", y = 470;
  const lines: string[] = [];
  for (const w of words) {
    if (g.measureText(line + w).width > 1000 && line) { lines.push(line.trim()); line = ""; }
    line += w + " ";
  }
  lines.push(line.trim());
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 100, y + i * 104 - (lines.length - 1) * 52));
  g.fillStyle = "#ffb454";
  g.font = "500 40px system-ui, sans-serif";
  g.fillText(subtitle, 100, 780);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
}

export function ChildTheme() {
  const [parentId, setParentId] = useState("divi");
  const [customTemplate, setCustomTemplate] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [author, setAuthor] = useState("Thavisha");
  const [authorUri, setAuthorUri] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [css, setCss] = useState("");
  const [withJs, setWithJs] = useState(false);
  const [withShot, setWithShot] = useState(true);
  const [withThemeJson, setWithThemeJson] = useState(true);
  const [withFolders, setWithFolders] = useState(false);
  const [file, setFile] = useState("style.css");

  const parent = PARENTS.find((p) => p.id === parentId)!;
  const template = parent.id === "custom" ? customTemplate.trim() : parent.template;
  const themeName = name.trim() || `${parent.id === "custom" ? "My" : parent.name} Child`;
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(themeName));
  }, [themeName, slugTouched]);
  const fn = (slug || "child").replace(/-/g, "_").replace(/^(\d)/, "_$1");

  const files = useMemo(() => {
    const out: Record<string, string> = {};
    out["style.css"] = `/*
 Theme Name:   ${themeName}
 Description:  ${description || `Child theme for ${parent.id === "custom" ? template || "the parent theme" : parent.name}.`}
 Author:       ${author}${authorUri ? `\n Author URI:   ${authorUri}` : ""}
 Template:     ${template || "parent-theme-folder"}
 Version:      ${version}
 Requires at least: 6.0
 Requires PHP: 7.4
 License:      GNU General Public License v2 or later
 License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 Text Domain:  ${slug}
*/

${css.trim() || "/* Your custom CSS goes below this line. */\n"}
`;
    const enqueue = parent.enqueue(fn, slug);
    const jsBlock = withJs
      ? `

add_action( 'wp_enqueue_scripts', '${fn}_enqueue_scripts' );
function ${fn}_enqueue_scripts() {
    wp_enqueue_script(
        '${slug}-custom',
        get_stylesheet_directory_uri() . '/assets/js/custom.js',
        array(),
        wp_get_theme()->get( 'Version' ),
        true
    );
}`
      : "";
    out["functions.php"] = `<?php
/**
 * ${themeName} functions.
 *
 * ${parent.note}
 */

defined( 'ABSPATH' ) || exit;
${enqueue ? `\n${enqueue}` : `\n// ${parent.name} loads this child theme's style.css automatically.`}${jsBlock}

/* Add your custom PHP below this line. */
`;
    if (withJs) out["assets/js/custom.js"] = `/* ${themeName} scripts */\n(function () {\n  'use strict';\n\n  document.addEventListener('DOMContentLoaded', function () {\n    // your code\n  });\n})();\n`;
    if (parent.block && withThemeJson) {
      out["theme.json"] = JSON.stringify({ $schema: "https://schemas.wp.org/trunk/theme.json", version: 3, settings: { color: { palette: [] } }, styles: {} }, null, 2) + "\n";
    }
    if (withFolders) {
      out["template-parts/.gitkeep"] = "";
      out["assets/css/.gitkeep"] = "";
      out["assets/images/.gitkeep"] = "";
    }
    out["readme.txt"] = `${themeName}\n${"=".repeat(themeName.length)}\n\nChild theme of ${parent.id === "custom" ? template : parent.name}.\n\nInstall: Appearance > Themes > Add New > Upload Theme, then activate.\nThe parent theme (${template}) must be installed.\n`;
    return out;
  }, [themeName, description, author, authorUri, template, version, slug, css, parent, fn, withJs, withThemeJson, withFolders]);

  const fileNames = Object.keys(files).filter((f) => !f.endsWith(".gitkeep"));
  const current = files[file] !== undefined ? file : "style.css";

  const download = async () => {
    const zip = new JSZip();
    const dir = zip.folder(slug || "child-theme")!;
    for (const [p, c] of Object.entries(files)) dir.file(p, c);
    if (withShot) dir.file("screenshot.jpg", await makeScreenshot(themeName, `Child theme of ${parent.id === "custom" ? template : parent.name}`));
    downloadBlob(`${slug || "child-theme"}.zip`, await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
  };

  return (
    <ToolFrame slug="child-theme">
      <Grid>
        <div className="stack">
          <Panel title="Parent theme">
            <div className="parents">
              {PARENTS.map((p) => (
                <button key={p.id} className={`parent${parentId === p.id ? " parent--on" : ""}`} onClick={() => setParentId(p.id)} aria-pressed={parentId === p.id}>
                  <strong>{p.name}</strong>
                  {p.template && <code>{p.template}</code>}
                </button>
              ))}
            </div>
            {parent.id === "custom" && <TextInput label="Parent theme folder name" hint="Exactly as in wp-content/themes/, e.g. twentytwentyfour" value={customTemplate} onChange={(e) => setCustomTemplate(e.target.value)} />}
            <p className="help">{parent.note}</p>
          </Panel>
          <Panel title="Details">
            <div className="row">
              <TextInput label="Child theme name" value={name} placeholder={themeName} onChange={(e) => setName(e.target.value)} />
              <TextInput label="Folder / text domain" value={slug} onChange={(e) => { setSlug(slugify(e.target.value) || ""); setSlugTouched(true); }} />
            </div>
            <div className="row">
              <TextInput label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              <TextInput label="Author URI" value={authorUri} placeholder="https://" onChange={(e) => setAuthorUri(e.target.value)} />
              <TextInput label="Version" value={version} onChange={(e) => setVersion(e.target.value)} style={{ maxWidth: 110 }} />
            </div>
            <TextInput label="Description" value={description} placeholder={`Child theme for ${parent.name}.`} onChange={(e) => setDescription(e.target.value)} />
            <TextArea label="Starting CSS (optional)" code rows={4} value={css} onChange={(e) => setCss(e.target.value)} placeholder=".site-header { … }" />
          </Panel>
          <Panel title="Include">
            <Check label="Screenshot" hint="A 1200×900 thumbnail with the theme name, so it's easy to spot in Appearance → Themes" checked={withShot} onChange={setWithShot} />
            <Check label="custom.js, enqueued in the footer" checked={withJs} onChange={setWithJs} />
            {parent.block && <Check label="theme.json" hint="For colour palette and style overrides" checked={withThemeJson} onChange={setWithThemeJson} />}
            <Check label="Empty assets/ and template-parts/ folders" checked={withFolders} onChange={setWithFolders} />
          </Panel>
        </div>

        <Panel
          title="Files"
          actions={
            <button className="btn btn--lantern" onClick={download} disabled={!template}>
              <Download size={16} /> Download {slug || "child-theme"}.zip
            </button>
          }
        >
          <Tabs value={current} onChange={setFile} tabs={fileNames.map((f) => [f, f] as [string, string])} />
          <Output value={files[current]} label={current} maxHeight={560} />
          <p className="help">Upload the ZIP in Appearance → Themes → Add New → Upload Theme. The parent theme must already be installed.</p>
        </Panel>
      </Grid>
    </ToolFrame>
  );
}
