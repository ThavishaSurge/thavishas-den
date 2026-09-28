/* Browser-side image encoding helpers. */

export type OutFormat = "webp" | "avif" | "jpeg" | "png";

export const MIME: Record<OutFormat, string> = { webp: "image/webp", avif: "image/avif", jpeg: "image/jpeg", png: "image/png" };

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function drawToCanvas(bmp: ImageBitmap, maxWidth: number | null, fill?: string): HTMLCanvasElement {
  const scale = maxWidth && bmp.width > maxWidth ? maxWidth / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  if (fill) {
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
  }
  g.drawImage(bmp, 0, 0, w, h);
  return c;
}

const canvasSupport = new Map<string, boolean>();

/* The Squoosh AVIF encoder (single-threaded), served from /public/codecs/avif. */
const AVIF_DEFAULTS = {
  quality: 50, qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 6, subsample: 1,
  chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false, bitDepth: 8, lossless: false,
};
type AvifModule = { encode: (data: Uint8Array, w: number, h: number, opts: typeof AVIF_DEFAULTS) => Uint8Array | null };
let avifPromise: Promise<AvifModule> | null = null;

function avifEncoder(): Promise<AvifModule> {
  if (!avifPromise) {
    // Loaded at runtime (not bundled) — see scripts/copy-codecs.mjs.
    const load = new Function("u", "return import(u)") as (u: string) => Promise<{ default: (o: object) => Promise<AvifModule> }>;
    avifPromise = load("/codecs/avif/avif_enc.js").then((m) => m.default({ noInitialRun: true }));
    avifPromise.catch(() => { avifPromise = null; });
  }
  return avifPromise;
}

async function canvasCanEncode(mime: string): Promise<boolean> {
  if (canvasSupport.has(mime)) return canvasSupport.get(mime)!;
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, mime, 0.5));
  const ok = !!blob && blob.type === mime;
  canvasSupport.set(mime, ok);
  return ok;
}

export async function encodeCanvas(c: HTMLCanvasElement, fmt: OutFormat, quality: number): Promise<Blob> {
  const mime = MIME[fmt];
  if (fmt === "avif" && !(await canvasCanEncode(mime))) {
    // Most browsers can't encode AVIF from a canvas, so use the Squoosh wasm encoder.
    const enc = await avifEncoder();
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const out = enc.encode(new Uint8Array(data.data.buffer), data.width, data.height, { ...AVIF_DEFAULTS, quality: Math.round(quality * 100) });
    if (!out) throw new Error("AVIF encoding failed.");
    return new Blob([out as BlobPart], { type: mime });
  }
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, mime, fmt === "png" ? undefined : quality));
  if (!blob) throw new Error(`This browser can't create ${fmt.toUpperCase()} images.`);
  return blob;
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error("PNG export failed"))), "image/png"));
}

/** Square icon with optional background, padding and rounded corners. */
export function iconCanvas(src: CanvasImageSource & { width: number; height: number }, size: number, opts: { bg: string | null; padding: number; radius: number }): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  if (opts.bg) {
    const r = (opts.radius / 100) * size;
    g.fillStyle = opts.bg;
    g.beginPath();
    g.roundRect(0, 0, size, size, r);
    g.fill();
  }
  const pad = (opts.padding / 100) * size;
  const box = size - pad * 2;
  const ratio = Math.min(box / src.width, box / src.height);
  const w = src.width * ratio, h = src.height * ratio;
  g.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  return c;
}

/** Packs PNG images into a .ico container (PNG-compressed entries, supported by every modern browser). */
export async function buildIco(pngs: { size: number; blob: Blob }[]): Promise<Blob> {
  const datas = await Promise.all(pngs.map(async (p) => new Uint8Array(await p.blob.arrayBuffer())));
  const headerSize = 6 + 16 * pngs.length;
  const total = headerSize + datas.reduce((s, d) => s + d.length, 0);
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true);
  v.setUint16(4, pngs.length, true);
  let offset = headerSize;
  pngs.forEach((p, i) => {
    const e = 6 + i * 16;
    v.setUint8(e, p.size >= 256 ? 0 : p.size);
    v.setUint8(e + 1, p.size >= 256 ? 0 : p.size);
    v.setUint8(e + 2, 0);
    v.setUint8(e + 3, 0);
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, datas[i].length, true);
    v.setUint32(e + 12, offset, true);
    new Uint8Array(buf, offset, datas[i].length).set(datas[i]);
    offset += datas[i].length;
  });
  return new Blob([buf], { type: "image/x-icon" });
}

/** Loads any image (including SVG) into an HTMLImageElement. */
export function loadImageEl(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be read."));
    img.src = url;
  });
}
