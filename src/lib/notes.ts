import type { FileResult, Report } from "./theme-diff/types";

export interface NoteOptions {
  client: string;
  project: string;
  order: string;
  tone: "friendly" | "professional" | "brief";
  install: "upload-zip" | "ftp" | "none";
  includeFiles: boolean;
  includeTesting: boolean;
  includeBackup: boolean;
  revisions: string;
  signoff: string;
  extra: string;
}

type Area = "Page templates" | "Styling" | "Scripts" | "Theme functions" | "WooCommerce" | "Images & fonts" | "Translations" | "Configuration" | "Other files";

function areaOf(f: FileResult): Area {
  const p = f.path.toLowerCase();
  if (p.startsWith("woocommerce/") || p.includes("/woocommerce/")) return "WooCommerce";
  if (/\.(css|scss|sass|less)$/.test(p)) return "Styling";
  if (/\.(js|mjs|ts|jsx|tsx)$/.test(p)) return "Scripts";
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot)$/.test(p)) return "Images & fonts";
  if (/\.(pot?|mo)$/.test(p)) return "Translations";
  if (/(^|\/)(functions\.php|inc\/|includes\/)/.test(p)) return "Theme functions";
  if (/\.(php|twig|liquid|html)$/.test(p)) return "Page templates";
  if (/\.(json|xml|yml|yaml|txt|md)$/.test(p)) return "Configuration";
  return "Other files";
}

const FRIENDLY_TEMPLATE: Record<string, string> = {
  "page-landing.php": "landing page template", "header.php": "site header", "footer.php": "site footer", "single.php": "blog post layout",
  "page.php": "default page layout", "archive.php": "archive pages", "404.php": "404 page", "search.php": "search results", "front-page.php": "homepage",
  "index.php": "fallback template", "sidebar.php": "sidebar", "comments.php": "comments section",
};

function humanise(h: string): string {
  return h
    .replace(/^Added function (\w+)\(\)$/, "New function $1()")
    .replace(/^Changed function (\w+)\(\)$/, "Updated $1()")
    .replace(/^Edited function (\w+)\(\)$/, "Updated $1()")
    .replace(/^Added shortcode \[(.+)\]$/, "New [$1] shortcode")
    .replace(/^Added selector (.+)$/, "New styles for $1")
    .replace(/^Edited selector (.+)$/, "Adjusted $1")
    .replace(/^Removed selector (.+)$/, "Removed unused styles for $1")
    .replace(/^Added (@media[^{]+)$/, "Responsive rules for $1")
    .replace(/^Added variable (--[\w-]+)$/, "New CSS variable $1")
    .replace(/^Added wp_enqueue_(style|script)\('(.+)'\)$/, "Loads the $2 $1")
    .replace(/^Removed function (\w+)\(\)$/, "Removed $1()")
    .replace(/^Adds /, "");
}

export function writeNotes(r: Report, o: NoteOptions): string {
  const files = r.files.filter((f) => f.status !== "unchanged" && !(f.cosmeticOnly && f.status === "modified"));
  const byArea = new Map<Area, FileResult[]>();
  for (const f of files) byArea.set(areaOf(f), [...(byArea.get(areaOf(f)) ?? []), f]);

  const t = r.totals;
  const name = o.project || r.afterMeta.name || r.beforeMeta.name || "the theme";
  const hi = o.client ? (o.tone === "professional" ? `Dear ${o.client},` : `Hi ${o.client},`) : o.tone === "professional" ? "Hello," : "Hi there,";
  const L: string[] = [];

  if (o.tone === "brief") {
    L.push(`${hi}`, "", `Delivery for ${name}${o.order ? ` (order ${o.order})` : ""}: ${t.modified} file${t.modified === 1 ? "" : "s"} updated, ${t.added} added, ${t.removed} removed.`);
  } else if (o.tone === "professional") {
    L.push(hi, "", `Please find the completed work on ${name}${o.order ? ` for order ${o.order}` : ""} attached. Below is a summary of the changes.`);
  } else {
    L.push(hi, "", `Your updates to ${name} are ready${o.order ? ` (order ${o.order})` : ""}! Here's a quick rundown of what I changed.`);
  }
  L.push("");

  if (r.beforeMeta.version && r.afterMeta.version && r.beforeMeta.version !== r.afterMeta.version) {
    L.push(`Version: ${r.beforeMeta.version} → ${r.afterMeta.version}`, "");
  }

  L.push(o.tone === "brief" ? "Changes:" : "What changed");
  const order: Area[] = ["Page templates", "Theme functions", "Styling", "Scripts", "WooCommerce", "Images & fonts", "Translations", "Configuration", "Other files"];
  for (const area of order) {
    const list = byArea.get(area);
    if (!list?.length) continue;
    const points = new Set<string>();
    for (const f of list) {
      const base = f.path.split("/").pop()!;
      if (f.status === "added") points.add(`Added ${FRIENDLY_TEMPLATE[base] ? `the ${FRIENDLY_TEMPLATE[base]} (${f.path})` : f.path}`);
      else if (f.status === "removed") points.add(`Removed ${f.path} (no longer needed)`);
      else if (f.status === "renamed") points.add(`Moved ${f.fromPath} to ${f.path}`);
      for (const h of f.highlights) if (h.tone !== "info" && points.size < 60) points.add(humanise(h.text));
      if (f.status === "modified" && !f.highlights.some((h) => h.tone !== "info")) points.add(`Updated ${FRIENDLY_TEMPLATE[base] ? `the ${FRIENDLY_TEMPLATE[base]}` : f.path}`);
    }
    L.push("", `${area}:`);
    [...points].slice(0, 12).forEach((p) => L.push(`• ${p}`));
    if (points.size > 12) L.push(`• …plus ${points.size - 12} smaller changes`);
  }

  if (o.extra.trim()) {
    L.push("", o.tone === "brief" ? "Notes:" : "Also worth knowing");
    o.extra.split("\n").filter((l) => l.trim()).forEach((l) => L.push(`• ${l.replace(/^[-*•]\s*/, "")}`));
  }

  if (o.includeFiles) {
    L.push("", "Files changed:");
    files.slice(0, 40).forEach((f) => L.push(`  ${f.status === "added" ? "+" : f.status === "removed" ? "−" : f.status === "renamed" ? "→" : "~"} ${f.path}`));
    if (files.length > 40) L.push(`  …and ${files.length - 40} more (see the attached report)`);
  }

  if (o.install !== "none") {
    L.push("", o.tone === "brief" ? "Install:" : "How to install");
    if (o.includeBackup) L.push("1. Take a backup of the site first (your host or UpdraftPlus).");
    const n = o.includeBackup ? 2 : 1;
    if (o.install === "upload-zip") {
      L.push(`${n}. In WordPress go to Appearance → Themes → Add New → Upload Theme and upload the attached ZIP.`, `${n + 1}. When asked, choose "Replace active with uploaded".`);
    } else {
      L.push(`${n}. Upload the files in the attached "changed files" ZIP to wp-content/themes/${r.afterRoot ?? "your-theme"}/ over FTP, overwriting the old ones.`);
      if (t.removed) L.push(`${n + 1}. Delete the ${t.removed} removed file${t.removed === 1 ? "" : "s"} listed above.`);
    }
    L.push(`${o.install === "upload-zip" ? n + 2 : n + (t.removed ? 2 : 1)}. Clear any cache (plugin, host or Cloudflare) and check the site in a private window.`);
  }

  if (o.includeTesting) {
    const tests: string[] = [];
    if (byArea.has("Styling")) tests.push("the design on mobile, tablet and desktop");
    if (byArea.has("WooCommerce")) tests.push("adding to cart and checkout");
    if (byArea.has("Scripts")) tests.push("menus, sliders and anything interactive");
    if (byArea.has("Theme functions")) tests.push("forms and any shortcodes on your pages");
    if (tests.length) L.push("", o.tone === "brief" ? `Please check: ${tests.join(", ")}.` : `Please take a look at ${tests.join(", ")} and let me know if anything looks off.`);
  }

  if (o.revisions) L.push("", o.tone === "professional" ? `This order includes ${o.revisions} revision${o.revisions === "1" ? "" : "s"} — please share any changes you'd like.` : `You've got ${o.revisions} revision${o.revisions === "1" ? "" : "s"} included, so just tell me if you'd like anything adjusted.`);

  L.push("", o.tone === "professional" ? "Kind regards," : o.tone === "brief" ? "Thanks," : "Thanks so much for working with me!", o.signoff || "Thavisha");
  return L.join("\n");
}
