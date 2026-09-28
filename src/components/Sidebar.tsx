"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, DatabaseBackup, House, Menu, PanelLeftClose, PanelLeftOpen, Pin, Search, X } from "lucide-react";
import { DenMark } from "./DenMark";
import { CATEGORIES, TOOLS, scoreTool, type DenTool } from "@/lib/tools";
import { usePins } from "@/lib/prefs";
import { useStored } from "@/lib/store";
import { openPalette } from "./CommandPalette";

function ToolLink({ t, active, collapsed, onNavigate }: { t: DenTool; active: boolean; collapsed: boolean; onNavigate: () => void }) {
  const Icon = t.icon;
  return (
    <Link
      href={`/tools/${t.slug}`}
      className={`nav-tool${active ? " nav-tool--active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      title={collapsed ? t.name : undefined}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span className="nav-tool__name">{t.name}</span>
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useStored<boolean>("den.nav.collapsed", false);
  const [closedGroups, setClosedGroups] = useStored<string[]>("den.nav.closed", []);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  const { pins } = usePins();

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    document.documentElement.dataset.nav = collapsed ? "collapsed" : "open";
  }, [collapsed]);

  const results = useMemo(
    () => (query.trim() ? TOOLS.map((t) => ({ t, s: scoreTool(t, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.t) : null),
    [query],
  );

  const activeSlug = path.startsWith("/tools/") ? path.split("/")[2] : null;
  const pinnedTools = pins.map((s) => TOOLS.find((t) => t.slug === s)).filter(Boolean) as DenTool[];
  const close = () => setDrawer(false);
  const isCollapsed = collapsed && !drawer;

  return (
    <>
      <div className="topbar">
        <button className="btn btn--ghost btn--sm" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Link href="/" className="topbar__brand">
          <DenMark size={28} /> Thavisha&rsquo;s Den
        </Link>
        <button className="btn btn--ghost btn--sm" onClick={openPalette} aria-label="Find a tool">
          <Search size={18} />
        </button>
      </div>

      {drawer && <div className="nav-scrim" onClick={close} aria-hidden="true" />}

      <nav className={`nav${isCollapsed ? " nav--collapsed" : ""}${drawer ? " nav--drawer" : ""}`} aria-label="Tools">
        <div className="nav__top">
          <Link href="/" className="nav__brand" onClick={close}>
            <DenMark size={34} />
            <span className="nav__brand-text">Thavisha&rsquo;s Den</span>
          </Link>
          <button
            className="btn btn--ghost btn--sm nav__collapse"
            onClick={() => (drawer ? close() : setCollapsed(!collapsed))}
            aria-label={drawer ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {drawer ? <X size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {isCollapsed ? (
          <button className="nav-tool nav__search-icon" onClick={openPalette} title="Find a tool (Ctrl K)">
            <Search size={17} strokeWidth={1.8} />
          </button>
        ) : (
          <label className="nav__search">
            <Search size={15} />
            <span className="visually-hidden">Find a tool</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a tool"
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
                if (e.key === "Enter" && results?.[0]) {
                  router.push(`/tools/${results[0].slug}`);
                  setQuery("");
                }
              }}
            />
            <kbd>⌘K</kbd>
          </label>
        )}

        <div className="nav__scroll">
          <Link href="/" className={`nav-tool${path === "/" ? " nav-tool--active" : ""}`} onClick={close} title={isCollapsed ? "Home" : undefined}>
            <House size={17} strokeWidth={1.8} />
            <span className="nav-tool__name">Home</span>
          </Link>

          {results ? (
            <div className="nav-group">
              <div className="nav-group__label">{results.length ? `${results.length} match${results.length > 1 ? "es" : ""}` : "No tools match"}</div>
              {results.map((t) => <ToolLink key={t.slug} t={t} active={activeSlug === t.slug} collapsed={isCollapsed} onNavigate={close} />)}
            </div>
          ) : (
            <>
              {pinnedTools.length > 0 && (
                <div className="nav-group">
                  <div className="nav-group__label nav-group__label--static">
                    <Pin size={13} /> <span>Pinned</span>
                  </div>
                  {pinnedTools.map((t) => <ToolLink key={t.slug} t={t} active={activeSlug === t.slug} collapsed={isCollapsed} onNavigate={close} />)}
                </div>
              )}
              {CATEGORIES.map((c) => {
                const tools = TOOLS.filter((t) => t.category === c.id);
                const hasActive = tools.some((t) => t.slug === activeSlug);
                const open = isCollapsed || hasActive || !closedGroups.includes(c.id);
                const Icon = c.icon;
                return (
                  <div key={c.id} className="nav-group">
                    {!isCollapsed && (
                      <button
                        className="nav-group__label"
                        aria-expanded={open}
                        onClick={() => setClosedGroups((g) => (g.includes(c.id) ? g.filter((x) => x !== c.id) : [...g, c.id]))}
                      >
                        <Icon size={13} />
                        <span>{c.name}</span>
                        <ChevronDown size={14} className="nav-group__chev" />
                      </button>
                    )}
                    {isCollapsed && <div className="nav-group__rule" />}
                    {open && tools.map((t) => <ToolLink key={t.slug} t={t} active={activeSlug === t.slug} collapsed={isCollapsed} onNavigate={close} />)}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="nav__foot">
          <Link href="/backup" className={`nav-tool${path === "/backup" ? " nav-tool--active" : ""}`} onClick={close} title={isCollapsed ? "Backup & restore" : undefined}>
            <DatabaseBackup size={17} strokeWidth={1.8} />
            <span className="nav-tool__name">Backup &amp; restore</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
