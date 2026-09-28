"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { TOOLS, categoryById, scoreTool, type DenTool } from "@/lib/tools";
import { useRecents } from "@/lib/prefs";

const EVENT = "den:palette";

export function openPalette() {
  window.dispatchEvent(new Event(EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { recents } = useRecents();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName) && !(e.target as HTMLElement).isContentEditable) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const list: DenTool[] = useMemo(() => {
    if (!q.trim()) {
      const recent = recents.map((s) => TOOLS.find((t) => t.slug === s)).filter(Boolean) as DenTool[];
      return [...recent, ...TOOLS.filter((t) => !recents.includes(t.slug))];
    }
    return TOOLS.map((t) => ({ t, s: scoreTool(t, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.t);
  }, [q, recents]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  const go = (t: DenTool | undefined) => {
    if (!t) return;
    setOpen(false);
    router.push(`/tools/${t.slug}`);
  };

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Find a tool" onMouseDown={() => setOpen(false)}>
      <div className="palette__box" onMouseDown={(e) => e.stopPropagation()}>
        <label className="palette__input">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            placeholder="Find a tool — try “webp”, “htaccess” or “jwt”"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") go(list[idx]);
            }}
            aria-activedescendant={list[idx] ? `pal-${list[idx].slug}` : undefined}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="palette__list" role="listbox">
          {!q.trim() && recents.length > 0 && <li className="palette__section">Recent</li>}
          {list.map((t, i) => {
            const Icon = t.icon;
            const showAllHeader = !q.trim() && recents.length > 0 && i === recents.length;
            return (
              <li key={t.slug} style={{ display: "contents" }}>
                {showAllHeader && <div className="palette__section">All tools</div>}
                <button
                  id={`pal-${t.slug}`}
                  role="option"
                  aria-selected={i === idx}
                  className={`palette__item${i === idx ? " palette__item--on" : ""}`}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(t)}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span className="palette__name">{t.name}</span>
                  <span className="palette__cat">{categoryById(t.category).name}</span>
                  {i === idx && <CornerDownLeft size={14} className="palette__enter" />}
                </button>
              </li>
            );
          })}
          {!list.length && <li className="palette__empty">No tool matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}
