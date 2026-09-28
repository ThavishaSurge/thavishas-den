"use client";

import { useEffect, useState } from "react";
import type { Report } from "./theme-diff/types";

/* In-memory hand-offs between tools (too big for localStorage, only needed for this visit). */

let lastDiff: { report: Report; after: File } | null = null;

export function setLastDiff(v: { report: Report; after: File }) {
  lastDiff = v;
}

export function getLastDiff() {
  return lastDiff;
}

/** Reads ?name=value from the URL after mount (so static pages still prerender). */
export function useQueryParam(name: string): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return v;
}
