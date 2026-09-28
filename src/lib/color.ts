/* Colour maths: parsing, WCAG contrast, palette extraction. */

export type RGB = [number, number, number];

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return null;
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]].map((x) => Math.min(255, x)) as RGB;
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return null;
}

export function toHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round) as RGB;
}

function lin(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Nudges the foreground's lightness until it reaches the target ratio, keeping hue and saturation. */
export function fixContrast(fg: RGB, bg: RGB, target: number): RGB | null {
  const [h, s, l] = rgbToHsl(fg);
  const bgL = luminance(bg);
  const dirs = bgL > 0.5 ? [-1, 1] : [1, -1];
  for (const dir of dirs) {
    for (let step = 1; step <= 100; step++) {
      const nl = l + (dir * step) / 100;
      if (nl < 0 || nl > 1) break;
      const c = hslToRgb(h, s, nl);
      if (contrast(c, bg) >= target) return c;
    }
  }
  return null;
}

/** k-means++ palette extraction on a downsampled image. */
export function extractPalette(data: Uint8ClampedArray, k: number): { color: RGB; share: number }[] {
  const px: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    px.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!px.length) return [];
  const dist = (a: RGB, b: RGB) => {
    // weighted RGB distance — cheap and close to perceptual for this purpose
    const rm = (a[0] + b[0]) / 2;
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
  };
  // seed
  let seed = 12345;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centers: RGB[] = [px[Math.floor(rand() * px.length)]];
  while (centers.length < k) {
    const d = px.map((p) => Math.min(...centers.map((c) => dist(p, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    if (sum === 0) break;
    let r = rand() * sum, i = 0;
    while (r > d[i] && i < d.length - 1) r -= d[i++];
    centers.push(px[i]);
  }
  const assign = new Array(px.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = dist(px[i], centers[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      assign[i] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      const s = sums[assign[i]];
      s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
    }
    sums.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const counts = centers.map(() => 0);
  assign.forEach((a) => counts[a]++);
  return centers
    .map((c, i) => ({ color: c.map(Math.round) as RGB, share: counts[i] / px.length }))
    .filter((x) => x.share > 0.004)
    .sort((a, b) => b.share - a.share);
}
