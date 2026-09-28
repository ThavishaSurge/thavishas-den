import JSZip from "jszip";

export interface ArchiveFile {
  /** Path with the shared root folder removed. */
  path: string;
  /** Original path inside the ZIP. */
  zipPath: string;
  bytes: Uint8Array;
  size: number;
  hash: string;
  binary: boolean;
  text?: string;
}

export interface Archive {
  files: Map<string, ArchiveFile>;
  root: string | null;
  excluded: number;
}

const TEXT_EXT = new Set([
  "php", "phtml", "inc", "js", "mjs", "cjs", "jsx", "ts", "tsx", "vue", "svelte",
  "css", "scss", "sass", "less", "styl", "html", "htm", "twig", "liquid", "hbs",
  "mustache", "tpl", "json", "xml", "svg", "txt", "md", "markdown", "pot", "po",
  "yml", "yaml", "ini", "conf", "htaccess", "env", "csv", "sql", "sh", "bat",
  "lock", "map", "rb", "py", "editorconfig", "gitignore", "gitattributes",
  "babelrc", "eslintrc", "prettierrc", "browserslistrc", "npmrc", "toml", "neon",
  "dist", "example", "log", "rtf", "jsonc",
]);

const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tif", "tiff", "psd",
  "woff", "woff2", "ttf", "otf", "eot", "zip", "gz", "tar", "rar", "7z", "pdf",
  "mo", "mp3", "mp4", "webm", "mov", "ogg", "wav", "exe", "dll", "so", "jar",
  "swf", "heic",
]);

export function extOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  if (base.startsWith(".") && !base.slice(1).includes(".")) return base.slice(1).toLowerCase();
  const i = base.lastIndexOf(".");
  return i === -1 ? "" : base.slice(i + 1).toLowerCase();
}

/** Turns a simple glob into a RegExp. Patterns without a slash match any file name. */
export function globToRegExp(glob: string): RegExp {
  let g = glob.trim().replace(/\\/g, "/");
  if (!g) return /$^/;
  if (!g.includes("/")) g = "**/" + g;
  if (g.endsWith("/")) g += "**";
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        const slash = g[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (".+^${}()|[]".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$", "i");
}

/** Fast, dependency-free 53-bit hash (cyrb53) over raw bytes. */
export function hashBytes(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 2654435761);
    h2 = Math.imul(h2 ^ b, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ":" + bytes.length;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });
const latin1 = new TextDecoder("latin1");

function decode(path: string, bytes: Uint8Array): { binary: boolean; text?: string } {
  const ext = extOf(path);
  if (BINARY_EXT.has(ext)) return { binary: true };
  const probe = bytes.subarray(0, Math.min(bytes.length, 8000));
  const hasNull = probe.includes(0);
  if (hasNull && !TEXT_EXT.has(ext)) return { binary: true };
  try {
    let text = utf8.decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { binary: false, text };
  } catch {
    if (TEXT_EXT.has(ext)) return { binary: false, text: latin1.decode(bytes) };
    return { binary: true };
  }
}

function commonRoot(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const first = paths[0].split("/")[0];
  if (!paths.every((p) => p.includes("/") && p.split("/")[0] === first)) return null;
  return first;
}

export async function readArchive(
  data: ArrayBuffer,
  exclude: string[],
  onFile?: (done: number, total: number, path: string) => void,
): Promise<Archive> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("One of the uploads isn't a readable ZIP file. Re-export it as a standard .zip and try again.");
  }

  const matchers = exclude.filter((p) => p.trim()).map(globToRegExp);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  let excluded = 0;

  const kept = entries.filter((f) => {
    const p = f.name.replace(/\\/g, "/");
    if (matchers.some((m) => m.test(p))) {
      excluded++;
      return false;
    }
    return true;
  });

  const root = commonRoot(kept.map((f) => f.name.replace(/\\/g, "/")));
  const files = new Map<string, ArchiveFile>();

  for (let i = 0; i < kept.length; i++) {
    const entry = kept[i];
    const zipPath = entry.name;
    const norm = zipPath.replace(/\\/g, "/");
    const path = root ? norm.slice(root.length + 1) : norm;
    if (!path) continue;
    // Re-check excludes against the root-less path too (e.g. "node_modules/**").
    if (root && matchers.some((m) => m.test(path))) {
      excluded++;
      continue;
    }
    const bytes = await entry.async("uint8array");
    const { binary, text } = decode(path, bytes);
    files.set(path, { path, zipPath, bytes, size: bytes.length, hash: hashBytes(bytes), binary, text });
    if (onFile && (i % 25 === 0 || i === kept.length - 1)) onFile(i + 1, kept.length, path);
  }

  return { files, root, excluded };
}
