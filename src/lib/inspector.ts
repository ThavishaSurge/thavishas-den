import { readArchive, extOf, type ArchiveFile } from "./theme-diff/archive";

export type Severity = "high" | "medium" | "low" | "info";

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  why: string;
  re: RegExp;
  /** Only scan these extensions (default: php). */
  ext?: string[];
}

export const RULES: Rule[] = [
  { id: "eval", title: "eval() call", severity: "high", re: /(?<![\w>$:])eval\s*\(/i,
    why: "Runs a string as PHP code. Rare in legitimate plugins and the most common way backdoors execute hidden payloads." },
  { id: "decode-exec", title: "Decoded payload being executed", severity: "high", re: /(eval|assert|create_function|call_user_func)\s*\(\s*(base64_decode|gzinflate|gzuncompress|str_rot13|hex2bin|strrev|rawurldecode)\s*\(/i,
    why: "Decodes an encoded string and runs it immediately — a classic obfuscated malware pattern." },
  { id: "gzinflate-b64", title: "Compressed + encoded blob", severity: "high", re: /(gzinflate|gzuncompress|gzdecode)\s*\(\s*(base64_decode|str_rot13)\s*\(/i,
    why: "Layered compression and encoding is used to hide code from scanners." },
  { id: "preg-e", title: "preg_replace with /e modifier", severity: "high", re: /preg_replace\s*\(\s*(['"])(.).*\2[imsxuADSUXJ]*e[imsxuADSUXJ]*\1/,
    why: "The /e modifier evaluates the replacement as PHP. It was removed in PHP 7 and today almost only appears in malware." },
  { id: "create-function", title: "create_function()", severity: "medium", re: /\bcreate_function\s*\(/i,
    why: "Deprecated and removed in PHP 8. Works like eval, so it's also abused by malware." },
  { id: "assert-var", title: "assert() on a variable", severity: "high", re: /\bassert\s*\(\s*\$/i,
    why: "On older PHP, assert() evaluates strings — used by webshells to run code from a variable." },
  { id: "shell", title: "Shell command execution", severity: "high", re: /(?<![\w>$:])(shell_exec|passthru|system|exec|popen|proc_open|pcntl_exec)\s*\(/i,
    why: "Runs commands on the server. Legitimate plugins almost never need this." },
  { id: "request-exec", title: "User input passed to code execution", severity: "high",
    re: /(eval|assert|system|exec|shell_exec|passthru|include|require|include_once|require_once)\s*\(?\s*[^;]*\$_(GET|POST|REQUEST|COOKIE|SERVER\[['"]HTTP_)/i,
    why: "Anything a visitor sends ends up executed or included — a remote code execution backdoor." },
  { id: "var-func", title: "Obfuscated function call", severity: "medium", re: /\$\w+\s*=\s*['"](base64_decode|str_rot13|gzinflate|eval|assert|create_function|shell_exec|system)['"]/i,
    why: "Stores a dangerous function name in a variable so it can be called as $var(…) without the name appearing in the code." },
  { id: "hex-string", title: "Hex/octal-escaped strings", severity: "medium", re: /(["'])(?:\\x[0-9a-f]{2}|\\[0-7]{3}){6,}/i,
    why: "Function names spelled out in escape codes (\\x65\\x76\\x61\\x6c = eval) to dodge detection." },
  { id: "chr-chain", title: "chr() concatenation chain", severity: "medium", re: /(chr\s*\(\s*\d+\s*\)\s*\.\s*){5,}/i,
    why: "Builds strings one character at a time — another way to hide function names." },
  { id: "long-b64", title: "Large encoded blob", severity: "medium", re: /['"][A-Za-z0-9+/]{600,}={0,2}['"]/,
    why: "A very long Base64 string inside PHP. Could be an embedded image or font, but also a hidden payload." },
  { id: "base64-decode", title: "base64_decode()", severity: "low", re: /\bbase64_decode\s*\(/i,
    why: "Common and often harmless (licence keys, images, APIs). Worth a look when it appears next to eval, include or file writes." },
  { id: "create-admin", title: "Creates a user with admin rights", severity: "high",
    re: /(wp_create_user|wp_insert_user)\s*\([^;]*(administrator)|set_role\s*\(\s*['"]administrator['"]\s*\)/i,
    why: "Silently creating administrator accounts is how backdoored (nulled) plugins keep access to a site." },
  { id: "file-write-php", title: "Writes a PHP file", severity: "medium", re: /(file_put_contents|fwrite|fputs)\s*\([^;]*\.php/i,
    why: "Writing new .php files at runtime can drop a webshell. Some caching and backup plugins do this legitimately." },
  { id: "remote-include", title: "Includes a remote file", severity: "high", re: /(include|require)(_once)?\s*\(?\s*['"]https?:\/\//i,
    why: "Loads PHP code from another server at runtime." },
  { id: "remote-code", title: "Fetches remote content and runs it", severity: "high",
    re: /(eval|assert)\s*\([^;]*(file_get_contents|wp_remote_retrieve_body|curl_exec)\s*\(/i,
    why: "Downloads code from the internet and executes it." },
  { id: "error-suppress", title: "Errors switched off", severity: "low", re: /\berror_reporting\s*\(\s*0\s*\)|ini_set\s*\(\s*['"]display_errors['"]\s*,\s*['"]?0/i,
    why: "Hiding all errors is common in malware so that failures go unnoticed. Occasionally used legitimately." },
  { id: "nulled", title: "Nulled / cracked marker", severity: "high",
    re: /\b(nulled|gpl\s*club|gplvault|wplocker|babiato|null24|codelist\.cc|festingervault|weadown|wpnull|nulljungle)\b/i, ext: ["php", "js", "txt", "md", "html"],
    why: "Mentions of known nulled-plugin distributors. These copies are frequently bundled with backdoors." },
  { id: "license-bypass", title: "Licence check bypassed", severity: "medium",
    re: /update_option\s*\(\s*['"][\w-]*(licen[cs]e|activation|purchase)[\w-]*['"]\s*,\s*['"]?(valid|activated|active|1|true)/i,
    why: "Hard-codes a licence as valid — typical of cracked plugins." },
  { id: "sqli", title: "Raw user input in a database query", severity: "medium",
    re: /\$wpdb->(query|get_results|get_row|get_var|get_col)\s*\(\s*["'][^;]*\$_(GET|POST|REQUEST|COOKIE)/i,
    why: "Request data goes straight into SQL without $wpdb->prepare() — a SQL injection risk." },
  { id: "xss", title: "Unescaped user input echoed", severity: "medium", re: /\b(echo|print)\s+[^;]*\$_(GET|POST|REQUEST|COOKIE)\[/i,
    why: "Printing request data without esc_html() / esc_attr() allows cross-site scripting." },
  { id: "unserialize", title: "unserialize() on user input", severity: "medium", re: /\bunserialize\s*\(\s*[^;]*\$_(GET|POST|REQUEST|COOKIE)/i,
    why: "Unserialising visitor data can lead to object-injection attacks." },
  { id: "iframe-js", title: "Hidden iframe or injected script", severity: "medium",
    re: /<iframe[^>]+(width|height)\s*=\s*['"]?0|document\.write\s*\(\s*unescape\s*\(|String\.fromCharCode\((\d+,\s*){15,}/i, ext: ["php", "js", "html"],
    why: "Invisible iframes and char-code scripts are used to inject spam or redirects." },
  { id: "js-eval", title: "JavaScript eval / atob chain", severity: "low", re: /\beval\s*\(\s*(atob|unescape|function\s*\(p,a,c,k,e)/i, ext: ["js"],
    why: "Packed or encoded JavaScript. Common in old minifiers, but also in injected scripts." },
];

export interface Finding {
  rule: Rule;
  path: string;
  line: number;
  snippet: string;
}

export interface Headers {
  [key: string]: string;
}

export interface InspectReport {
  kind: "plugin" | "theme" | "child-theme" | "block-theme" | "shopify-theme" | "unknown";
  name: string;
  mainFile: string | null;
  headers: Headers;
  readme: Headers & { changelogTop?: string };
  stats: { files: number; php: number; js: number; css: number; lines: number; bytes: number; minifiedJs: number; vendor: string[] };
  findings: Finding[];
  missingAbspath: string[];
  warnings: string[];
  root: string | null;
}

const PLUGIN_KEYS = ["Plugin Name", "Plugin URI", "Description", "Version", "Requires at least", "Requires PHP", "Tested up to", "Author", "Author URI", "License", "License URI", "Text Domain", "Domain Path", "Network", "Update URI", "Requires Plugins", "WC requires at least", "WC tested up to"];
const THEME_KEYS = ["Theme Name", "Theme URI", "Description", "Version", "Requires at least", "Tested up to", "Requires PHP", "Author", "Author URI", "Template", "License", "License URI", "Text Domain", "Tags"];
const README_KEYS = ["Contributors", "Tags", "Requires at least", "Tested up to", "Requires PHP", "Stable tag", "License"];

function parseHeader(text: string, keys: string[]): Headers {
  const head = text.slice(0, 8192);
  const out: Headers = {};
  for (const k of keys) {
    const m = head.match(new RegExp(`^[ \\t/*#@]*${k.replace(/ /g, "\\s+")}\\s*:(.*)$`, "mi"));
    if (m && m[1].trim()) out[k] = m[1].replace(/\s*(?:\*\/|\?>).*$/, "").trim();
  }
  return out;
}

function parseReadme(text: string): InspectReport["readme"] {
  const out: InspectReport["readme"] = parseHeader(text, README_KEYS);
  const m = text.match(/==\s*Changelog\s*==\s*([\s\S]*?)(?:\n==\s|\n=\s*[\d.]+\s*=[\s\S]*?\n=\s*[\d.]+\s*=|$)/i);
  if (m) out.changelogTop = m[1].trim().split(/\n\s*\n/).slice(0, 2).join("\n\n").slice(0, 1200);
  return out;
}

const yieldLoop = () => new Promise<void>((r) => setTimeout(r, 0));

export async function inspectZip(buf: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<InspectReport> {
  const archive = await readArchive(buf, ["__MACOSX/**", "**/.DS_Store", "**/.git/**"]);
  const files = [...archive.files.values()];

  // detect kind
  let kind: InspectReport["kind"] = "unknown";
  let mainFile: string | null = null;
  let headers: Headers = {};
  const style = archive.files.get("style.css");
  if (style?.text) {
    const h = parseHeader(style.text, THEME_KEYS);
    if (h["Theme Name"]) {
      headers = h;
      mainFile = "style.css";
      kind = h.Template ? "child-theme" : archive.files.has("theme.json") && [...archive.files.keys()].some((p) => p.startsWith("templates/")) ? "block-theme" : "theme";
    }
  }
  if (kind === "unknown") {
    const topPhp = files.filter((f) => !f.path.includes("/") && f.path.endsWith(".php") && f.text);
    const all = [...topPhp, ...files.filter((f) => f.path.split("/").length === 2 && f.path.endsWith(".php") && f.text)];
    for (const f of all) {
      const h = parseHeader(f.text!, PLUGIN_KEYS);
      if (h["Plugin Name"]) {
        headers = h;
        mainFile = f.path;
        kind = "plugin";
        break;
      }
    }
  }
  if (kind === "unknown" && archive.files.has("config/settings_schema.json") && [...archive.files.keys()].some((p) => p.startsWith("sections/"))) {
    kind = "shopify-theme";
    try {
      const info = (JSON.parse(archive.files.get("config/settings_schema.json")!.text!) as Record<string, string>[]).find((s) => s.name === "theme_info");
      if (info) headers = { "Theme Name": info.theme_name, Version: info.theme_version, Author: info.theme_author, "Documentation": info.theme_documentation_url };
    } catch { /* ignore */ }
  }

  const readmeFile = archive.files.get("readme.txt") ?? archive.files.get("README.txt");
  const readme = readmeFile?.text ? parseReadme(readmeFile.text) : {};

  // stats
  const stats: InspectReport["stats"] = { files: files.length, php: 0, js: 0, css: 0, lines: 0, bytes: 0, minifiedJs: 0, vendor: [] };
  const vendorDirs = new Set<string>();
  for (const f of files) {
    stats.bytes += f.size;
    const e = extOf(f.path);
    if (e === "php") stats.php++;
    if (e === "js") { stats.js++; if (/\.min\.js$/.test(f.path)) stats.minifiedJs++; }
    if (e === "css") stats.css++;
    if (f.text) stats.lines += f.text.split("\n").length;
    const vm = f.path.match(/^(?:.*\/)?(vendor|node_modules|lib|libraries|freemius)\/([^/]+)\//);
    if (vm) vendorDirs.add(`${vm[1]}/${vm[2]}`);
  }
  stats.vendor = [...vendorDirs].sort().slice(0, 40);

  // scan
  const findings: Finding[] = [];
  const missingAbspath: string[] = [];
  const scanFiles = files.filter((f) => f.text && !f.binary);
  for (let i = 0; i < scanFiles.length; i++) {
    const f = scanFiles[i];
    const e = extOf(f.path);
    const lines = f.text!.split("\n");
    for (const rule of RULES) {
      const exts = rule.ext ?? ["php", "phtml", "inc"];
      if (!exts.includes(e)) continue;
      let hits = 0;
      for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        if (line.length > 20000) {
          // huge single line (minified / obfuscated) — test a window
          if (rule.re.test(line.slice(0, 20000))) findings.push({ rule, path: f.path, line: ln + 1, snippet: line.slice(0, 180) + "…" });
          continue;
        }
        if (rule.re.test(line)) {
          const trimmed = line.trim();
          // skip obvious comments for low-signal rules
          if (rule.severity !== "high" && /^(\/\/|\*|#)/.test(trimmed)) continue;
          findings.push({ rule, path: f.path, line: ln + 1, snippet: trimmed.length > 220 ? trimmed.slice(0, 217) + "…" : trimmed });
          if (++hits >= 20) break;
        }
      }
    }
    if (e === "php" && kind === "plugin" && f.path !== mainFile && !/(^|\/)(vendor|node_modules|tests?)\//.test(f.path)) {
      const head = f.text!.slice(0, 2000);
      const guarded = /defined\s*\(\s*['"](ABSPATH|WPINC)['"]\s*\)/.test(head);
      // files that only declare things are safe to load directly
      const body = head.replace(/^\s*<\?php/, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|#).*$/gm, "").trim();
      const declarative = /^(namespace|class|interface|trait|enum|abstract|final|return|use|declare)\b/.test(body) || body === "";
      if (!guarded && !declarative) missingAbspath.push(f.path);
    }
    if (i % 40 === 0) {
      onProgress?.(i, scanFiles.length);
      await yieldLoop();
    }
  }

  // warnings
  const warnings: string[] = [];
  const ver = headers.Version;
  if (readme["Stable tag"] && ver && readme["Stable tag"] !== ver && readme["Stable tag"] !== "trunk") {
    warnings.push(`Header says version ${ver} but readme.txt Stable tag is ${readme["Stable tag"]}.`);
  }
  if (kind === "plugin" && !headers["Requires PHP"] && !readme["Requires PHP"]) warnings.push("No minimum PHP version declared (Requires PHP).");
  if ((kind === "theme" || kind === "child-theme" || kind === "block-theme") && !archive.files.has("screenshot.png") && !archive.files.has("screenshot.jpg")) warnings.push("No screenshot.png — the theme shows a blank thumbnail in Appearance → Themes.");
  if (kind === "child-theme" && !archive.files.has("functions.php")) warnings.push("Child theme has no functions.php. Fine if the parent loads child styles itself.");
  if (headers["Text Domain"] && archive.root && headers["Text Domain"] !== archive.root) warnings.push(`Text Domain "${headers["Text Domain"]}" doesn't match the folder name "${archive.root}".`);
  if (kind === "unknown") warnings.push("Couldn't find a plugin header or theme style.css. Is this the right ZIP?");

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  findings.sort((a, b) => order[a.rule.severity] - order[b.rule.severity] || a.path.localeCompare(b.path) || a.line - b.line);

  return {
    kind,
    name: headers["Plugin Name"] ?? headers["Theme Name"] ?? archive.root ?? "Unnamed package",
    mainFile, headers, readme, stats, findings, missingAbspath, warnings, root: archive.root,
  };
}

export type { ArchiveFile };
