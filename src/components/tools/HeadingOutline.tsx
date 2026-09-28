"use client";

import { useState } from "react";
import { Heading, Globe } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, Notice, Panel, Segmented, Stat, TextArea } from "../ui";
import { CopyButton } from "../CopyButton";
import { fetchPage, normaliseUrl } from "@/lib/web";

interface H {
  level: number;
  text: string;
  issue?: string;
}

interface Outline {
  title: string;
  description: string;
  headings: H[];
  url?: string;
  images: { total: number; noAlt: number };
  words: number;
}

function analyse(html: string, url?: string): Outline {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  const headings: H[] = [];
  let prev = 0;
  let h1 = 0;
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
    const level = Number(el.tagName[1]);
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    let issue: string | undefined;
    if (!text) issue = el.querySelector("img[alt]") ? `Image-only heading (alt: “${el.querySelector("img")!.getAttribute("alt")}”)` : "Empty heading";
    else if (prev && level > prev + 1) issue = `Skips from H${prev} to H${level}`;
    else if (text.length > 90) issue = "Very long for a heading";
    if (level === 1 && ++h1 > 1) issue = issue ?? "Another H1";
    headings.push({ level, text, issue });
    prev = level;
  });
  const imgs = [...doc.querySelectorAll("img")];
  return {
    title: doc.querySelector("title")?.textContent?.trim() ?? "",
    description: doc.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
    headings,
    url,
    images: { total: imgs.length, noAlt: imgs.filter((i) => !i.hasAttribute("alt")).length },
    words: (doc.body?.textContent ?? "").split(/\s+/).filter((w) => /\w/.test(w)).length,
  };
}

export function HeadingOutline() {
  const [source, setSource] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [out, setOut] = useState<Outline | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    if (source === "html") {
      if (html.trim()) setOut(analyse(html));
      return;
    }
    const u = normaliseUrl(url);
    if (!u) return;
    setBusy(true);
    try {
      const p = await fetchPage(u);
      if (!p.html) throw new Error(`That URL returned ${p.contentType || "no content"}, not an HTML page.`);
      setOut(analyse(p.html, p.url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that page.");
    } finally {
      setBusy(false);
    }
  };

  const h1s = out?.headings.filter((h) => h.level === 1).length ?? 0;
  const issues = out?.headings.filter((h) => h.issue).length ?? 0;
  const asText = out ? out.headings.map((h) => `${"  ".repeat(h.level - 1)}H${h.level} ${h.text || "(empty)"}`).join("\n") : "";

  return (
    <ToolFrame slug="heading-outline">
      <Panel title="Page" actions={<Segmented label="Source" value={source} onChange={setSource} options={[["url", "From a URL"], ["html", "Paste HTML"]]} />}>
        {source === "url" ? (
          <form className="bp-url" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/services" aria-label="Page URL" />
            <button className="btn btn--lantern" type="submit" disabled={busy || !url.trim()}><Globe size={15} /> {busy ? "Loading…" : "Show outline"}</button>
          </form>
        ) : (
          <>
            <TextArea code rows={8} value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Paste the page source (View source → Select all → Copy)" />
            <button className="btn btn--lantern" style={{ alignSelf: "flex-start" }} onClick={run} disabled={!html.trim()}><Heading size={15} /> Show outline</button>
          </>
        )}
        <p className="help">Reads the HTML the server sends. Headings added later by JavaScript (some page builders, sliders and tabs) won&rsquo;t appear — paste the HTML from DevTools → Elements to include them.</p>
      </Panel>
      {error && <div style={{ marginTop: 16 }}><Notice tone="error">{error}</Notice></div>}

      {!out ? (
        <Panel><Empty icon={<Heading size={28} />} title="See the page's structure">A clean outline has one H1 and headings that step down one level at a time, like a table of contents.</Empty></Panel>
      ) : (
        <>
          <Panel>
            <div className="kvs">
              <Stat label="headings" value={out.headings.length} />
              <Stat label={h1s === 1 ? "H1" : "H1s"} value={h1s} tone={h1s === 1 ? "add" : "rem"} />
              <Stat label="issues" value={issues} tone={issues ? "mod" : "add"} />
              <Stat label="words" value={out.words.toLocaleString()} />
              <Stat label="images without alt" value={out.images.noAlt} tone={out.images.noAlt ? "mod" : undefined} />
            </div>
            {h1s === 0 && <Notice tone="warn">No H1. Give the page one main heading that says what it&rsquo;s about.</Notice>}
            {h1s > 1 && <Notice tone="warn">{h1s} H1s. Often a logo or a page-builder title — keep one and change the rest to H2 or a styled paragraph.</Notice>}
            <dl className="dl">
              <div><dt>Title</dt><dd>{out.title || <span className="t-rem">missing</span>}</dd></div>
              <div><dt>Description</dt><dd>{out.description || <span className="t-rem">missing</span>}</dd></div>
            </dl>
          </Panel>
          <Panel title="Outline" actions={<CopyButton text={asText} label="Copy outline" />}>
            <ol className="outline">
              {out.headings.map((h, i) => (
                <li key={i} className={`outline__item${h.issue ? " outline__item--issue" : ""}`} style={{ paddingLeft: (h.level - 1) * 22 }}>
                  <span className={`outline__lvl outline__lvl--${h.level}`}>H{h.level}</span>
                  <span className="outline__text">{h.text || <em className="muted">(empty)</em>}</span>
                  {h.issue && <span className="chip tone-change">{h.issue}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </>
      )}
    </ToolFrame>
  );
}
