/// <reference lib="webworker" />
import { analyzeThemes } from "./analyze";
import type { WorkerRequest, WorkerResponse } from "./types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { before, after, beforeName, afterName, options } = e.data;
  const post = (m: WorkerResponse) => ctx.postMessage(m);
  try {
    const report = await analyzeThemes(before, after, { before: beforeName, after: afterName }, options, (progress) =>
      post({ type: "progress", progress }),
    );
    post({ type: "done", report });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
