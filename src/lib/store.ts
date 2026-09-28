"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Small localStorage-backed store shared by every tool.
 * All Den data lives under keys starting with "den." so it can be backed up in one go.
 */

const listeners = new Map<string, Set<() => void>>();
const memory = new Map<string, string>(); // fallback when storage is blocked
const cacheRaw = new Map<string, string | null>();
const cacheVal = new Map<string, unknown>();
const serverFallback = new Map<string, unknown>();

function stableFallback<T>(key: string, fallback: T): T {
  if (!serverFallback.has(key)) serverFallback.set(key, fallback);
  return serverFallback.get(key) as T;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
  cacheRaw.delete(key);
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, cb: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      cacheRaw.delete(key);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getParsed<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (cacheRaw.has(key) && cacheRaw.get(key) === raw) return cacheVal.get(key) as T;
  let val: T = fallback;
  if (raw !== null) {
    try {
      val = JSON.parse(raw) as T;
    } catch {
      val = fallback;
    }
  }
  cacheRaw.set(key, raw);
  cacheVal.set(key, val);
  return val;
}

export function getStored<T>(key: string, fallback: T): T {
  return getParsed(key, fallback);
}

export function setStored<T>(key: string, value: T) {
  writeRaw(key, JSON.stringify(value));
}

/** useState that persists to localStorage and syncs across components and tabs. */
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => getParsed(key, stableFallback(key, fallback)),
    () => stableFallback(key, fallback),
  );
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const prev = getParsed(key, fallback);
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      setStored(key, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/* ---------- backup ---------- */

export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("den.")) {
        try {
          out[k] = JSON.parse(localStorage.getItem(k)!);
        } catch {
          out[k] = localStorage.getItem(k);
        }
      }
    }
  } catch {
    for (const [k, v] of memory) if (k.startsWith("den.")) out[k] = JSON.parse(v);
  }
  return out;
}

export function importAll(data: Record<string, unknown>, mode: "merge" | "replace"): number {
  let n = 0;
  if (mode === "replace") {
    const existing = Object.keys(exportAll());
    for (const k of existing) writeRaw(k, null);
  }
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith("den.")) continue;
    writeRaw(k, JSON.stringify(v));
    n++;
  }
  return n;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
