"use client";

import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Trash2, FolderOpen } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Notice, Output, Panel, TextArea, TextInput } from "../ui";
import { runRegex, toPhp, type RxResult } from "@/lib/regex";
import { useStored, uid } from "@/lib/store";
import { CopyButton } from "../CopyButton";

interface Saved {
  id: string;
  name: string;
  source: string;
  flags: string;
  sample?: string;
}

const STARTERS: Omit<Saved, "id">[] = [
  { name: "Email address", source: String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`, flags: "gi" },
  { name: "URL", source: String.raw`https?:\/\/[^\s"'<>]+`, flags: "gi" },
  { name: "Sri Lankan mobile", source: String.raw`(?:\+94|0)7\d[\s-]?\d{3}[\s-]?\d{4}`, flags: "g" },
  { name: "Hex colour", source: String.raw`#(?:[0-9a-f]{3}){1,2}\b`, flags: "gi" },
  { name: "WordPress shortcode", source: String.raw`\[(?<tag>[\w-]+)(?<atts>[^\]]*)\](?:(?<content>[\s\S]*?)\[\/\k<tag>\])?`, flags: "g" },
  { name: "HTML tag", source: String.raw`<\/?([a-z][a-z0-9-]*)\b[^>]*>`, flags: "gi" },
  { name: "Slug", source: String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*$`, flags: "gm" },
  { name: "IPv4 address", source: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`, flags: "g" },
];

const FLAGS: [string, string][] = [
  ["g", "global — find all matches"],
  ["i", "ignore case"],
  ["m", "multiline — ^ and $ match each line"],
  ["s", "dot matches new lines"],
  ["u", "unicode"],
];

const CHEATS: [string, string][] = [
  [String.raw`\d`, "digit"], [String.raw`\w`, "word char"], [String.raw`\s`, "space"], [".", "any char"],
  ["^", "start"], ["$", "end"], ["*", "0 or more"], ["+", "1 or more"], ["?", "optional"], ["{2,5}", "2 to 5"],
  ["[abc]", "one of"], ["[^abc]", "none of"], ["(…)", "group"], ["(?<name>…)", "named group"], ["(?:…)", "non-capturing"],
  ["a|b", "or"], [String.raw`\b`, "word boundary"], ["(?=…)", "followed by"], ["(?!…)", "not followed by"],
];

const SAMPLE = `Contact us at hello@fragrancevault.lk or sales@example.com.
Call +94 77 123 4567 or 071-234-5678.
Brand colour: #ff8a3d, accent #3ee.
[product_badge label="New"]Fresh stock[/product_badge]
Visit https://example.com/shop?sort=price for more.`;

const HUES = ["var(--lantern)", "var(--add)", "var(--move)", "#6fc3ff", "var(--rem)"];

export function RegexTester() {
  const [source, setSource] = useState(String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`);
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState(SAMPLE);
  const [replacement, setReplacement] = useState("");
  const [useReplace, setUseReplace] = useState(false);
  const [result, setResult] = useState<RxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useStored<Saved[]>("den.regex.saved", []);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!source) {
      setResult(null);
      setError(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      runRegex(source, flags, text, useReplace ? replacement : null)
        .then((r) => { if (alive) { setResult(r); setError(null); } })
        .catch((e: Error) => { if (alive) { setResult(null); setError(e.message.replace(/^Invalid regular expression: /, "")); } });
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [source, flags, text, replacement, useReplace]);

  const highlighted = useMemo(() => {
    if (!result) return [<span key="t">{text}</span>];
    const out: React.ReactNode[] = [];
    let last = 0;
    result.matches.forEach((m, i) => {
      if (m.index > last) out.push(<span key={`t${i}`}>{text.slice(last, m.index)}</span>);
      out.push(
        <mark key={`m${i}`} className="rx-mark" style={{ ["--hue" as string]: HUES[i % HUES.length] }} title={`Match ${i + 1}`}>
          {m.text || "​"}
        </mark>,
      );
      last = m.end;
    });
    out.push(<span key="end">{text.slice(last)}</span>);
    return out;
  }, [result, text]);

  const toggleFlag = (f: string) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, "") : cur + f));
  const groupNames = result?.matches[0]?.named ? Object.keys(result.matches[0].named) : [];
  const groupCount = result?.matches[0]?.groups.length ?? 0;

  return (
    <ToolFrame slug="regex-tester" wide>
      <div className="rx-layout">
        <div className="stack">
          <Panel title="Pattern">
            <div className="rx-pattern">
              <span className="rx-slash">/</span>
              <input className="inp inp--code rx-input" value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} aria-label="Regular expression" placeholder="Type a pattern" />
              <span className="rx-slash">/{flags}</span>
            </div>
            <div className="rx-flags">
              {FLAGS.map(([f, label]) => (
                <button key={f} className={`rx-flag${flags.includes(f) ? " rx-flag--on" : ""}`} onClick={() => toggleFlag(f)} aria-pressed={flags.includes(f)} title={label}>
                  <code>{f}</code> <span>{label.split(" — ")[0]}</span>
                </button>
              ))}
            </div>
            <div className="rx-cheats">
              {CHEATS.map(([tok, label]) => (
                <button key={tok} className="rx-cheat" onClick={() => setSource((s) => s + tok.replace("…", ""))} title={`Insert ${label}`}>
                  <code>{tok}</code> <span>{label}</span>
                </button>
              ))}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </Panel>

          <Panel
            title={result ? `${result.matches.length}${result.truncated ? "+" : ""} match${result.matches.length === 1 ? "" : "es"}` : "Test text"}
            actions={result && <span className="muted" style={{ fontSize: 12.5 }}>{result.ms.toFixed(1)} ms</span>}
          >
            <TextArea code value={text} onChange={(e) => setText(e.target.value)} rows={7} aria-label="Test text" />
            <div className="rx-preview" aria-label="Matches highlighted">{highlighted}</div>
          </Panel>

          <Panel
            title="Replace"
            actions={<label className="chk"><input type="checkbox" checked={useReplace} onChange={(e) => setUseReplace(e.target.checked)} /> <span>Preview replacement</span></label>}
          >
            <TextInput label="Replace with" hint="Use $1, $2 or $<name> for groups" value={replacement} onChange={(e) => { setReplacement(e.target.value); setUseReplace(true); }} className="inp inp--code" />
            {useReplace && result?.replaced != null && <Output value={result.replaced} label="Result" maxHeight={240} />}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Matches" pad={false}>
            {result && result.matches.length ? (
              <div className="tbl-wrap rx-table">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Match</th>
                      {Array.from({ length: groupCount }).map((_, i) => (
                        <th key={i}>{groupNames[i] ? `${groupNames[i]}` : `$${i + 1}`}</th>
                      ))}
                      <th className="num">At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.slice(0, 300).map((m, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td><code>{m.text}</code></td>
                        {m.groups.map((g, j) => <td key={j}><code className={g === undefined ? "muted" : ""}>{g ?? "—"}</code></td>)}
                        <td className="num muted">{m.index}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title={source ? "No matches" : "Type a pattern"}>{source ? "Try turning on the i flag or loosening the pattern." : "Matches show up here as you type."}</Empty>
            )}
          </Panel>

          <Panel title="Use it in code">
            <div className="rx-code">
              <span className="muted">JavaScript</span>
              <code>{`/${source}/${flags}`}</code>
              <CopyButton text={`/${source}/${flags}`} />
            </div>
            <div className="rx-code">
              <span className="muted">PHP</span>
              <code>{`preg_match_all(${toPhp(source, flags)}, $subject, $m);`}</code>
              <CopyButton text={`preg_match_all(${toPhp(source, flags)}, $subject, $m);`} />
            </div>
            <p className="help">Patterns run on the JavaScript engine. PHP (PCRE) accepts almost all of the same syntax.</p>
          </Panel>

          <Panel title="Saved patterns">
            <div className="row">
              <TextInput label="Name this pattern" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order number" />
              <button
                className="btn"
                disabled={!source || !name.trim()}
                onClick={() => {
                  setSaved([{ id: uid(), name: name.trim(), source, flags, sample: text.slice(0, 2000) }, ...saved]);
                  setName("");
                }}
              >
                <BookmarkPlus size={15} /> Save
              </button>
            </div>
            <ul className="rx-saved">
              {saved.map((s) => (
                <li key={s.id}>
                  <button className="rx-saved__load" onClick={() => { setSource(s.source); setFlags(s.flags); if (s.sample) setText(s.sample); }}>
                    <strong>{s.name}</strong>
                    <code>/{s.source}/{s.flags}</code>
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setSaved(saved.filter((x) => x.id !== s.id))} aria-label={`Delete ${s.name}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <details className="rx-starters">
              <summary><FolderOpen size={14} /> Starter patterns</summary>
              <ul className="rx-saved">
                {STARTERS.map((s) => (
                  <li key={s.name}>
                    <button className="rx-saved__load" onClick={() => { setSource(s.source); setFlags(s.flags); }}>
                      <strong>{s.name}</strong>
                      <code>/{s.source}/{s.flags}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        </div>
      </div>
    </ToolFrame>
  );
}
