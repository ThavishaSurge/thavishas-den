import JSZip from "jszip";

const cache = new WeakMap<File, Promise<JSZip>>();

/** Opens an uploaded ZIP once and reuses it for previews and exports. */
export function openZip(file: File): Promise<JSZip> {
  let p = cache.get(file);
  if (!p) {
    p = file.arrayBuffer().then((b) => JSZip.loadAsync(b));
    cache.set(file, p);
  }
  return p;
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp",
};

export function imageMime(path: string): string | null {
  return MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export async function entryUrl(file: File, zipPath: string, mime: string): Promise<string | null> {
  const zip = await openZip(file);
  const entry = zip.file(zipPath);
  if (!entry) return null;
  const bytes = await entry.async("uint8array");
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
}
