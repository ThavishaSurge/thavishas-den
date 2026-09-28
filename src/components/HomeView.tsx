"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Globe, History, Pin, Search } from "lucide-react";
import { CATEGORIES, TOOLS, scoreTool, type DenTool } from "@/lib/tools";
import { usePins, useRecents } from "@/lib/prefs";

function Card({ t }: { t: DenTool }) {
  const Icon = t.icon;
  return (
    <Link href={`/tools/${t.slug}`} className="tcard">
      <span className="tcard__icon"><Icon size={19} strokeWidth={1.8} /></span>
      <span className="tcard__text">
        <span className="tcard__name">
          {t.name}
          {t.online && <Globe size={12} className="tcard__online" aria-label="Fetches live sites" />}
        </span>
        <span className="tcard__summary">{t.summary}</span>
      </span>
    </Link>
  );
}

function Chip({ t }: { t: DenTool }) {
  const Icon = t.icon;
  return (
    <Link href={`/tools/${t.slug}`} className="qchip">
      <Icon size={15} strokeWidth={1.8} /> {t.name}
    </Link>
  );
}

export function HomeView() {
  const [q, setQ] = useState("");
  const { pins } = usePins();
  const { recents } = useRecents();
  const find = (s: string) => TOOLS.find((t) => t.slug === s);
  const pinned = pins.map(find).filter(Boolean) as DenTool[];
  const recent = recents.map(find).filter((t): t is DenTool => !!t && !pins.includes(t.slug)).slice(0, 5);

  const matches = useMemo(
    () => (q.trim() ? TOOLS.map((t) => ({ t, s: scoreTool(t, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.t) : null),
    [q],
  );

  return (
    <div className="home">
      <header className="home__hero">
        <h1 className="home__title">
          <span>Thavisha&rsquo;s</span>
          <span>Den</span>
        </h1>
        <p className="home__lede">
          {TOOLS.length} tools for building, fixing and handing over websites. Files you drop in are processed in this browser tab.
        </p>
        <label className="home__search">
          <Search size={20} />
          <span className="visually-hidden">Find a tool</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you need to do? Try “compress”, “redirect” or “salts”" autoComplete="off" />
          <kbd>⌘K</kbd>
        </label>
      </header>

      {matches ? (
        <section className="home__section">
          <h2 className="home__h2">{matches.length ? `${matches.length} tool${matches.length > 1 ? "s" : ""} match “${q}”` : `Nothing matches “${q}”`}</h2>
          <div className="tgrid">{matches.map((t) => <Card key={t.slug} t={t} />)}</div>
        </section>
      ) : (
        <>
          {(pinned.length > 0 || recent.length > 0) && (
            <div className="home__quick">
              {pinned.length > 0 && (
                <div className="home__quick-row">
                  <span className="home__quick-label"><Pin size={14} /> Pinned</span>
                  {pinned.map((t) => <Chip key={t.slug} t={t} />)}
                </div>
              )}
              {recent.length > 0 && (
                <div className="home__quick-row">
                  <span className="home__quick-label"><History size={14} /> Recent</span>
                  {recent.map((t) => <Chip key={t.slug} t={t} />)}
                </div>
              )}
            </div>
          )}

          <nav className="home__jump" aria-label="Categories">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <a key={c.id} href={`#${c.id}`}>
                  <Icon size={15} /> {c.name}
                </a>
              );
            })}
          </nav>

          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const tools = TOOLS.filter((t) => t.category === c.id);
            return (
              <section key={c.id} id={c.id} className="home__section">
                <h2 className="home__h2">
                  <Icon size={17} /> {c.name}
                  <span className="home__count">{tools.length}</span>
                </h2>
                <div className="tgrid">{tools.map((t) => <Card key={t.slug} t={t} />)}</div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
