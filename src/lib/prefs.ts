"use client";

import { useStored } from "./store";

export function usePins() {
  const [pins, setPins] = useStored<string[]>("den.pins", []);
  const toggle = (slug: string) => setPins((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  return { pins, toggle, isPinned: (slug: string) => pins.includes(slug) };
}

export function useRecents() {
  const [recents, setRecents] = useStored<string[]>("den.recents", []);
  const touch = (slug: string) => setRecents((r) => [slug, ...r.filter((s) => s !== slug)].slice(0, 6));
  return { recents, touch };
}
