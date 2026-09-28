"use client";

import { useMemo, useState } from "react";
import { BookMarked, Download, Plus, Search, Star, Trash2, Upload, Tag } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Panel, Select, TextArea, TextInput, downloadText } from "../ui";
import { CopyButton } from "../CopyButton";
import { useStored, uid } from "@/lib/store";

export interface Snippet {
  id: string;
  title: string;
  lang: string;
  tags: string[];
  code: string;
  notes: string;
  favorite: boolean;
  updatedAt: number;
}

const LANGS = ["PHP", "CSS", "JavaScript", "HTML", "SQL", "Shell", "JSON", "Liquid", "Other"];

const STARTERS: Omit<Snippet, "id" | "updatedAt">[] = [
  { title: "Disable XML-RPC", lang: "PHP", tags: ["wordpress", "security"], favorite: false, notes: "Paste into the child theme's functions.php or a code snippets plugin.",
    code: "add_filter( 'xmlrpc_enabled', '__return_false' );" },
  { title: "Hide admin bar for non-admins", lang: "PHP", tags: ["wordpress"], favorite: false, notes: "",
    code: "add_action( 'after_setup_theme', function () {\n    if ( ! current_user_can( 'administrator' ) && ! is_admin() ) {\n        show_admin_bar( false );\n    }\n} );" },
  { title: "Change WooCommerce add-to-cart text", lang: "PHP", tags: ["woocommerce"], favorite: false, notes: "",
    code: "add_filter( 'woocommerce_product_single_add_to_cart_text', fn() => __( 'Add to bag', 'woocommerce' ) );\nadd_filter( 'woocommerce_product_add_to_cart_text', fn() => __( 'Add to bag', 'woocommerce' ) );" },
  { title: "Custom excerpt length", lang: "PHP", tags: ["wordpress"], favorite: false, notes: "",
    code: "add_filter( 'excerpt_length', fn() => 24, 999 );" },
  { title: "Visually hidden (screen-reader only)", lang: "CSS", tags: ["accessibility"], favorite: false, notes: "",
    code: ".visually-hidden {\n  position: absolute !important;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n}" },
  { title: "Debounce", lang: "JavaScript", tags: ["utility"], favorite: false, notes: "Wrap resize or input handlers.",
    code: "const debounce = (fn, wait = 200) => {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), wait);\n  };\n};" },
];

export function SnippetLibrary() {
  const [snippets, setSnippets] = useStored<Snippet[]>("den.snippets", []);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  const tags = useMemo(() => [...new Set(snippets.flatMap((s) => s.tags))].sort(), [snippets]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return snippets
      .filter((s) => (!tag || s.tags.includes(tag)) && (lang === "all" || s.lang === lang))
      .filter((s) => !needle || [s.title, s.code, s.notes, ...s.tags].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
  }, [snippets, q, tag, lang]);

  const active = snippets.find((s) => s.id === activeId) ?? null;
  const update = (patch: Partial<Snippet>) => {
    if (!active) return;
    setSnippets(snippets.map((s) => (s.id === active.id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  };
  const create = () => {
    const s: Snippet = { id: uid(), title: "Untitled snippet", lang: lang === "all" ? "PHP" : lang, tags: tag ? [tag] : [], code: "", notes: "", favorite: false, updatedAt: Date.now() };
    setSnippets([s, ...snippets]);
    setActiveId(s.id);
  };

  return (
    <ToolFrame slug="snippets" wide>
      <div className="sn-layout">
        <aside className="sn-side panel">
          <div className="sn-side__top">
            <label className="search">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, code or tags" aria-label="Search snippets" />
            </label>
            <div className="row" style={{ alignItems: "center" }}>
              <select className="inp" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language" style={{ flex: 1 }}>
                <option value="all">All languages</option>
                {LANGS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button className="btn btn--lantern" onClick={create}><Plus size={15} /> New</button>
            </div>
            {tags.length > 0 && (
              <div className="filters">
                <button className={`filter${!tag ? " filter--on" : ""}`} onClick={() => setTag(null)}>All tags</button>
                {tags.map((t) => (
                  <button key={t} className={`filter${tag === t ? " filter--on" : ""}`} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>
                ))}
              </div>
            )}
          </div>
          <div className="sn-list">
            {list.map((s) => (
              <button key={s.id} className={`sn-item${s.id === activeId ? " sn-item--on" : ""}`} onClick={() => setActiveId(s.id)}>
                <span className="sn-item__title">
                  {s.favorite && <Star size={12} className="t-mod" fill="currentColor" />} {s.title}
                </span>
                <span className="sn-item__meta">
                  <span className="sn-lang">{s.lang}</span>
                  {s.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                </span>
              </button>
            ))}
            {snippets.length > 0 && list.length === 0 && <p className="help" style={{ padding: 14 }}>No snippets match.</p>}
          </div>
          <div className="sn-side__foot">
            <button className="btn btn--ghost btn--sm" disabled={!snippets.length} onClick={() => downloadText("den-snippets.json", JSON.stringify(snippets, null, 2), "application/json")}>
              <Download size={14} /> Export
            </button>
            <label className="btn btn--ghost btn--sm">
              <Upload size={14} /> Import
              <input type="file" accept=".json" className="visually-hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const incoming = JSON.parse(await f.text()) as Snippet[];
                  const ids = new Set(snippets.map((s) => s.id));
                  setSnippets([...incoming.filter((s) => s.code !== undefined && !ids.has(s.id)), ...snippets]);
                } catch { alert("That file isn't a snippet export."); }
                e.target.value = "";
              }} />
            </label>
          </div>
        </aside>

        <div className="sn-main">
          {snippets.length === 0 ? (
            <Panel>
              <Empty icon={<BookMarked size={30} />} title="Your snippet library is empty">
                <p>Save the PHP, CSS and JS you paste into client sites over and over.</p>
                <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                  <button className="btn btn--lantern" onClick={create}><Plus size={15} /> New snippet</button>
                  <button className="btn" onClick={() => setSnippets(STARTERS.map((s) => ({ ...s, id: uid(), updatedAt: Date.now() })))}>Add 6 starter snippets</button>
                </div>
              </Empty>
            </Panel>
          ) : !active ? (
            <Panel>
              <Empty icon={<BookMarked size={30} />} title="Pick a snippet">Choose one from the list, or create a new one.</Empty>
            </Panel>
          ) : (
            <Panel
              title={
                <input className="sn-title" value={active.title} onChange={(e) => update({ title: e.target.value })} aria-label="Snippet title" />
              }
              actions={
                <>
                  <button className={`btn btn--sm${active.favorite ? " btn--pinned" : ""}`} onClick={() => update({ favorite: !active.favorite })} aria-pressed={active.favorite}>
                    <Star size={14} fill={active.favorite ? "currentColor" : "none"} /> Favourite
                  </button>
                  <CopyButton text={active.code} label="Copy code" className="btn--copy-strong" />
                  <button className="btn btn--ghost btn--sm" onClick={() => { if (confirm(`Delete “${active.title}”?`)) { setSnippets(snippets.filter((s) => s.id !== active.id)); setActiveId(null); } }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              }
            >
              <div className="row">
                <Select label="Language" value={active.lang} onChange={(e) => update({ lang: e.target.value })} options={LANGS} />
                <div className="fld" style={{ flex: "2 1 260px" }}>
                  <span className="fld__label">Tags</span>
                  <div className="sn-tags">
                    {active.tags.map((t) => (
                      <button key={t} className="sn-tag" onClick={() => update({ tags: active.tags.filter((x) => x !== t) })} title="Remove tag">
                        #{t} ×
                      </button>
                    ))}
                    <input
                      className="sn-tag-input"
                      value={tagDraft}
                      placeholder={active.tags.length ? "Add tag" : "Add tags — press Enter"}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && tagDraft.trim()) {
                          e.preventDefault();
                          const t = tagDraft.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
                          if (!active.tags.includes(t)) update({ tags: [...active.tags, t] });
                          setTagDraft("");
                        }
                      }}
                    />
                    <Tag size={14} className="muted" />
                  </div>
                </div>
              </div>
              <TextArea code value={active.code} onChange={(e) => update({ code: e.target.value })} rows={18} placeholder="Paste your code" aria-label="Snippet code" />
              <TextInput label="Notes" value={active.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Where it goes, which clients use it, gotchas…" />
              <p className="help">Saved automatically. Last edited {new Date(active.updatedAt).toLocaleString()}</p>
            </Panel>
          )}
        </div>
      </div>
    </ToolFrame>
  );
}
