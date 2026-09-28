"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Globe, Pin, PinOff } from "lucide-react";
import { categoryById, toolBySlug } from "@/lib/tools";
import { usePins, useRecents } from "@/lib/prefs";

/** Standard header + frame for every tool page. */
export function ToolFrame({ slug, children, wide = false }: { slug: string; children: React.ReactNode; wide?: boolean }) {
  const tool = toolBySlug(slug)!;
  const cat = categoryById(tool.category);
  const { isPinned, toggle } = usePins();
  const { touch } = useRecents();
  const pinned = isPinned(slug);

  useEffect(() => {
    touch(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className={`tool${wide ? " tool--wide" : ""}`}>
      <header className="tool__head">
        <div className="tool__crumbs">
          <Link href={`/#${cat.id}`}>{cat.name}</Link>
        </div>
        <div className="tool__title-row">
          <h1 className="tool__title">{tool.name}</h1>
          <button
            type="button"
            className={`btn btn--sm${pinned ? " btn--pinned" : ""}`}
            onClick={() => toggle(slug)}
            aria-pressed={pinned}
            title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            {pinned ? "Pinned" : "Pin"}
          </button>
        </div>
        <p className="tool__lede">
          {tool.summary}
          {tool.online && (
            <span className="tool__online" title="This tool fetches live pages through the Den's own server routes.">
              <Globe size={13} /> Fetches live sites
            </span>
          )}
        </p>
      </header>
      {children}
    </div>
  );
}
