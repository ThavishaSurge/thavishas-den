import type { WorkerRequest, WorkerResponse, Progress, Report, DiffOptions } from "./types";

/**
 * Runs the analysis in a Web Worker so the page stays responsive.
 * Falls back to the main thread if workers aren't available.
 */
export async function runAnalysis(
  before: File,
  after: File,
  options: DiffOptions,
  onProgress: (p: Progress) => void,
): Promise<Report> {
  const [a, b] = await Promise.all([before.arrayBuffer(), after.arrayBuffer()]);

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }

  if (!worker) {
    const { analyzeThemes } = await import("./analyze");
    return analyzeThemes(a, b, { before: before.name, after: after.name }, options, onProgress);
  }

  return new Promise<Report>((resolve, reject) => {
    const w = worker!;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.type === "progress") onProgress(m.progress);
      else if (m.type === "done") { w.terminate(); resolve(m.report); }
      else { w.terminate(); reject(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "The comparison worker stopped unexpectedly.")); };
    const req: WorkerRequest = { before: a, after: b, beforeName: before.name, afterName: after.name, options };
    w.postMessage(req, [a, b]);
  });
}
