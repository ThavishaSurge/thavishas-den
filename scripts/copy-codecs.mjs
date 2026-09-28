// Copies the single-threaded AVIF encoder into public/ so the browser can load it directly.
// (Bundling @jsquash/avif makes Turbopack follow its multi-threaded worker and hang.)
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const from = "node_modules/@jsquash/avif/codec/enc/";
const to = "public/codecs/avif/";
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  for (const f of ["avif_enc.js", "avif_enc.wasm"]) copyFileSync(from + f, to + f);
  console.log("AVIF encoder copied to public/codecs/avif");
}
