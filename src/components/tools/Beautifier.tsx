"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, FileUp, Sparkles, Minimize2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Notice, Output, Panel, Segmented, Select, TextArea } from "../ui";
import { detectLang, type Lang } from "@/lib/minify";
import { beautify, minify, describeError, type FormatOptions } from "@/lib/format";
import { useStored } from "@/lib/store";
import { formatBytes } from "../theme-diff/DropSlab";

const LANGS: [Lang, string][] = [["html", "HTML"], ["css", "CSS"], ["js", "JavaScript"], ["php", "PHP"], ["json", "JSON"]];
const EXT: Record<Lang, string> = { html: "html", css: "css", js: "js", php: "php", json: "json" };

export function Beautifier() {
  const [code, setCode] = useState("");
  const [lang, setLang] = useState<Lang>("html");
  const [mode, setMode] = useStored<"beautify" | "minify">("den.beautifier.mode", "beautify");
  const [opts, setOpts] = useStored<FormatOptions & { aggressiveHtml: boolean }>("den.beautifier.opts", {
    indent: "4", printWidth: 100, singleQuote: true, aggressiveHtml: false,
  });
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoLang, setAutoLang] = useState<Lang | null>(null);

  const run = async (m = mode, l = lang, src = code) => {
    if (!src.trim()) {
      setResult("");
      setError(null);
      return;
    }
    setBusy(true);
    try {
      const out = m === "beautify" ? await beautify(src, l, opts) : await minify(src, l, opts);
      setResult(out);
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // re-run when options change
  useEffect(() => {
    if (code.trim()) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang, opts]);

  const onPaste = (text: string) => {
    setCode(text);
    const d = detectLang(text);
    setAutoLang(d);
    if (d && d !== lang) setLang(d);
  };

  const before = new Blob([code]).size;
  const after = new Blob([result]).size;
  const saved = before ? Math.round((1 - after / before) * 100) : 0;

  return (
    <ToolFrame slug="beautifier" wide>
      <div className="bf-bar">
        <Segmented label="Mode" value={mode} onChange={setMode} options={[["beautify", "Beautify", <Sparkles key="b" size={14} />], ["minify", "Minify", <Minimize2 key="m" size={14} />]]} />
        <Segmented label="Language" value={lang} onChange={(l) => { setLang(l); setAutoLang(null); }} options={LANGS} />
        <label className="btn btn--sm">
          <FileUp size={14} /> Open file
          <input
            type="file"
            className="visually-hidden"
            accept=".html,.htm,.css,.scss,.js,.mjs,.json,.php,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              const ext = f.name.split(".").pop()?.toLowerCase();
              const byExt: Record<string, Lang> = { html: "html", htm: "html", css: "css", scss: "css", js: "js", mjs: "js", json: "json", php: "php" };
              setCode(text);
              if (ext && byExt[ext]) setLang(byExt[ext]);
              run(mode, (ext && byExt[ext]) || lang, text);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <details className="bf-opts">
        <summary>Formatting options</summary>
        <div className="row">
          <Select label="Indent" value={opts.indent} onChange={(e) => setOpts({ ...opts, indent: e.target.value as FormatOptions["indent"] })} options={[["2", "2 spaces"], ["4", "4 spaces"], ["tab", "Tabs"]]} />
          <Select label="Line width" value={String(opts.printWidth)} onChange={(e) => setOpts({ ...opts, printWidth: Number(e.target.value) })} options={["80", "100", "120", "160"]} />
          <div className="fld" style={{ justifyContent: "flex-end", gap: 10 }}>
            <Check label="Single quotes (JS / PHP)" checked={opts.singleQuote} onChange={(v) => setOpts({ ...opts, singleQuote: v })} />
            <Check label="Remove all space between HTML tags" hint="Smaller, but can join inline words together" checked={opts.aggressiveHtml} onChange={(v) => setOpts({ ...opts, aggressiveHtml: v })} />
          </div>
        </div>
      </details>

      <div className="grid grid--2">
        <Panel
          title="Your code"
          actions={
            <button className="btn btn--lantern btn--sm" onClick={() => run()} disabled={!code.trim() || busy}>
              {mode === "beautify" ? <Sparkles size={14} /> : <Minimize2 size={14} />}
              {busy ? "Working…" : mode === "beautify" ? "Beautify" : "Minify"}
            </button>
          }
        >
          <TextArea
            code
            value={code}
            rows={22}
            placeholder={`Paste ${LANGS.find((l) => l[0] === lang)![1]} here — the language is detected automatically.`}
            onChange={(e) => onPaste(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            }}
            className="bf-area"
          />
          <p className="help">
            {autoLang ? `Detected ${LANGS.find((l) => l[0] === autoLang)![1]}. ` : ""}Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run.
          </p>
        </Panel>

        <Panel
          title="Result"
          actions={
            result && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setCode(result); setResult(""); }} title="Move the result into the editor">
                <ArrowLeftRight size={14} /> Use as input
              </button>
            )
          }
        >
          {error ? (
            <Notice tone="error"><strong>Couldn&rsquo;t parse this {LANGS.find((l) => l[0] === lang)![1]}.</strong> {error}</Notice>
          ) : null}
          <Output value={result} filename={result ? `${mode === "minify" ? "minified" : "formatted"}.${EXT[lang]}` : undefined} maxHeight={520} />
          {result && (
            <div className="kvs">
              <div className="kv"><span className="kv__value">{formatBytes(before)}</span><span className="kv__label">before</span></div>
              <div className="kv"><span className="kv__value">{formatBytes(after)}</span><span className="kv__label">after</span></div>
              <div className={`kv ${saved > 0 ? "kv--add" : saved < 0 ? "kv--mod" : ""}`}>
                <span className="kv__value">{saved > 0 ? `−${saved}%` : saved < 0 ? `+${-saved}%` : "0%"}</span>
                <span className="kv__label">{saved >= 0 ? "smaller" : "larger"}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>
      {lang === "php" && mode === "minify" && (
        <p className="help" style={{ marginTop: 12 }}>PHP minify strips comments and whitespace like <code>php -w</code>. Keep the formatted original — minified PHP is for size, not editing.</p>
      )}
    </ToolFrame>
  );
}
