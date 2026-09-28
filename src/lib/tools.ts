import {
  GitCompare, Wand2, Regex, Binary, BookMarked, PackageSearch, Baby, ArrowRightLeft, FileCog, MonitorSmartphone,
  Ruler, Palette, ImageDown, AppWindow, Search, Braces, Gauge, Route, Unlink, Heading, ScrollText, ShieldCheck,
  CalendarClock, Clock, ClipboardCheck, Send, FolderKanban, Code2, Blocks, Brush, TrendingUp, Server, Users,
  type LucideIcon,
} from "lucide-react";

export type CategoryId = "code" | "wordpress" | "frontend" | "seo" | "server" | "clients";

export interface DenCategory {
  id: CategoryId;
  name: string;
  icon: LucideIcon;
}

export const CATEGORIES: DenCategory[] = [
  { id: "code", name: "Code & files", icon: Code2 },
  { id: "wordpress", name: "WordPress & e-commerce", icon: Blocks },
  { id: "frontend", name: "Front-end & design", icon: Brush },
  { id: "seo", name: "SEO & performance", icon: TrendingUp },
  { id: "server", name: "Debugging & server", icon: Server },
  { id: "clients", name: "Client workflow", icon: Users },
];

export interface DenTool {
  slug: string;
  name: string;
  summary: string;
  icon: LucideIcon;
  category: CategoryId;
  keywords: string[];
  /** Fetches live websites through the Den's server routes. */
  online?: boolean;
}

/**
 * Every tool in the Den. Add an entry here and a page at
 * src/app/tools/<slug>/page.tsx — navigation, search and home pick it up.
 */
export const TOOLS: DenTool[] = [
  // Code & files
  { slug: "theme-diff", name: "Theme Diff", category: "code", icon: GitCompare,
    summary: "Compare a theme ZIP before and after changes and get the exact code to add, replace or remove.",
    keywords: ["zip", "compare", "changes", "patch", "diff", "files"] },
  { slug: "beautifier", name: "Beautify & Minify", category: "code", icon: Wand2,
    summary: "Format or minify HTML, CSS, JavaScript, PHP and JSON.",
    keywords: ["prettier", "format", "minify", "compress", "pretty", "indent"] },
  { slug: "regex-tester", name: "Regex Tester", category: "code", icon: Regex,
    summary: "Test patterns with live matching, groups and replace, and keep a library of saved patterns.",
    keywords: ["regular expression", "pattern", "match", "replace", "preg"] },
  { slug: "encode-decode", name: "Encode & Decode", category: "code", icon: Binary,
    summary: "Base64, URL and HTML entities, a JWT decoder and MD5 / SHA hash generator.",
    keywords: ["base64", "url", "entities", "jwt", "token", "hash", "md5", "sha256"] },
  { slug: "snippets", name: "Snippet Library", category: "code", icon: BookMarked,
    summary: "Your own tagged, searchable store of PHP, CSS and JS snippets.",
    keywords: ["snippets", "library", "saved", "code", "functions.php"] },

  // WordPress & e-commerce
  { slug: "plugin-inspector", name: "Plugin & Theme Inspector", category: "wordpress", icon: PackageSearch,
    summary: "Read headers and versions from a plugin or theme ZIP and flag risky code like eval or base64_decode.",
    keywords: ["security", "malware", "scan", "eval", "nulled", "headers", "version"] },
  { slug: "child-theme", name: "Child Theme Generator", category: "wordpress", icon: Baby,
    summary: "Generate an installable child theme ZIP for Divi, Hello Elementor, Astra and more.",
    keywords: ["child theme", "divi", "elementor", "hello", "astra", "style.css"] },
  { slug: "shopify-to-woo", name: "Shopify → WooCommerce CSV", category: "wordpress", icon: ArrowRightLeft,
    summary: "Convert a Shopify product export into a WooCommerce import CSV, variants included.",
    keywords: ["shopify", "woocommerce", "csv", "migration", "products", "import"] },
  { slug: "config-files", name: "Config File Generator", category: "wordpress", icon: FileCog,
    summary: "Build wp-config.php, .htaccess and robots.txt files from simple options.",
    keywords: ["wp-config", "htaccess", "robots", "salts", "redirect", "https"] },

  // Front-end & design
  { slug: "breakpoints", name: "Breakpoint Previewer", category: "frontend", icon: MonitorSmartphone,
    summary: "See a URL at mobile, tablet and desktop widths side by side.",
    keywords: ["responsive", "mobile", "tablet", "desktop", "viewport", "iframe"] },
  { slug: "fluid-type", name: "Fluid Type & Units", category: "frontend", icon: Ruler,
    summary: "CSS clamp() calculator for fluid type and spacing, plus a px ↔ rem converter.",
    keywords: ["clamp", "fluid", "typography", "rem", "px", "em", "units"] },
  { slug: "colors", name: "Contrast & Palette", category: "frontend", icon: Palette,
    summary: "Check WCAG contrast and pull a colour palette out of a screenshot.",
    keywords: ["contrast", "wcag", "accessibility", "palette", "colors", "extract", "screenshot"] },
  { slug: "image-optimizer", name: "Image Optimizer", category: "frontend", icon: ImageDown,
    summary: "Compress images, convert to WebP or AVIF, and optimise SVGs.",
    keywords: ["compress", "webp", "avif", "jpeg", "png", "svg", "svgo", "resize"] },
  { slug: "favicons", name: "Favicon Generator", category: "frontend", icon: AppWindow,
    summary: "Turn one image into a full favicon and app icon pack with the HTML to paste.",
    keywords: ["favicon", "ico", "apple touch icon", "manifest", "pwa", "icon"] },

  // SEO & performance
  { slug: "meta-preview", name: "SERP & Social Preview", category: "seo", icon: Search, online: true,
    summary: "Preview how a page looks on Google, Facebook, WhatsApp and X, and generate the meta tags.",
    keywords: ["serp", "open graph", "og", "twitter card", "meta tags", "title", "description"] },
  { slug: "schema-builder", name: "Schema Builder", category: "seo", icon: Braces,
    summary: "Build JSON-LD for LocalBusiness, Product, FAQ and Hotel pages.",
    keywords: ["schema", "json-ld", "structured data", "rich results", "faq", "hotel", "product"] },
  { slug: "pagespeed", name: "PageSpeed Tracker", category: "seo", icon: Gauge, online: true,
    summary: "Run Google PageSpeed Insights and keep a score history for every site.",
    keywords: ["pagespeed", "lighthouse", "core web vitals", "lcp", "cls", "performance"] },
  { slug: "redirect-checker", name: "Redirect Chain Checker", category: "seo", icon: Route, online: true,
    summary: "Follow every hop from a URL to its final destination with status codes and timings.",
    keywords: ["redirect", "301", "302", "chain", "hops", "canonical"] },
  { slug: "broken-links", name: "Broken Link Crawler", category: "seo", icon: Unlink, online: true,
    summary: "Crawl a page or site and list links that return errors.",
    keywords: ["404", "broken links", "crawler", "dead links", "audit"] },
  { slug: "heading-outline", name: "Heading Outline", category: "seo", icon: Heading, online: true,
    summary: "See a page's H1–H6 structure and spot skipped levels or missing H1s.",
    keywords: ["headings", "h1", "h2", "outline", "structure", "accessibility"] },

  // Debugging & server
  { slug: "error-log", name: "PHP Error Log Parser", category: "server", icon: ScrollText,
    summary: "Paste or upload debug.log and see repeated errors grouped, counted and traced to plugins.",
    keywords: ["debug.log", "php errors", "warnings", "fatal", "notice", "wp_debug"] },
  { slug: "site-check", name: "Headers, SSL & DNS", category: "server", icon: ShieldCheck, online: true,
    summary: "Inspect HTTP response and security headers, SSL certificates and DNS records.",
    keywords: ["headers", "security headers", "ssl", "certificate", "dns", "mx", "txt", "spf"] },
  { slug: "cron-builder", name: "Cron Builder", category: "server", icon: CalendarClock,
    summary: "Build and read cron expressions and see the next run times.",
    keywords: ["cron", "crontab", "schedule", "wp-cron"] },
  { slug: "timestamp", name: "Timestamp Converter", category: "server", icon: Clock,
    summary: "Convert Unix timestamps and dates across time zones.",
    keywords: ["unix", "epoch", "timestamp", "date", "timezone", "iso"] },

  // Client workflow
  { slug: "maintenance-report", name: "Maintenance Reports", category: "clients", icon: ClipboardCheck,
    summary: "Write monthly WordPress maintenance reports with updates, backups and uptime, ready to send.",
    keywords: ["maintenance", "report", "care plan", "updates", "backups", "uptime", "client"] },
  { slug: "delivery-notes", name: "Delivery Notes", category: "clients", icon: Send,
    summary: "Auto-write Fiverr handover notes from a before/after theme ZIP.",
    keywords: ["fiverr", "delivery", "handover", "notes", "changelog"] },
  { slug: "projects", name: "Project Dashboard", category: "clients", icon: FolderKanban,
    summary: "Each client's URLs, stack and notes in one place.",
    keywords: ["clients", "projects", "sites", "crm", "dashboard", "urls"] },
];

export function toolBySlug(slug: string): DenTool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function categoryById(id: CategoryId): DenCategory {
  return CATEGORIES.find((c) => c.id === id)!;
}

/** Tiny fuzzy score: prefers name matches, then keywords, then summary. */
export function scoreTool(t: DenTool, q: string): number {
  const query = q.trim().toLowerCase();
  if (!query) return 1;
  const name = t.name.toLowerCase();
  let s = 0;
  for (const word of query.split(/\s+/)) {
    if (name.startsWith(word)) s += 6;
    else if (name.includes(word)) s += 4;
    else if (t.keywords.some((k) => k.includes(word))) s += 3;
    else if (categoryById(t.category).name.toLowerCase().includes(word)) s += 2;
    else if (t.summary.toLowerCase().includes(word)) s += 1;
    else return 0;
  }
  return s;
}
