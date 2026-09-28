import type { Lang } from "./minify";

export interface FormatOptions {
  indent: "2" | "4" | "tab";
  printWidth: number;
  singleQuote: boolean;
}

/** Beautify with Prettier, loaded on demand so the page stays light. */
export async function beautify(code: string, lang: Lang, o: FormatOptions): Promise<string> {
  if (lang === "json") {
    return JSON.stringify(JSON.parse(code), null, o.indent === "tab" ? "\t" : Number(o.indent)) + "\n";
  }
  const prettier = await import("prettier/standalone");
  const common = {
    printWidth: o.printWidth,
    tabWidth: o.indent === "tab" ? 4 : Number(o.indent),
    useTabs: o.indent === "tab",
    singleQuote: o.singleQuote,
  };
  if (lang === "css") {
    const postcss = await import("prettier/plugins/postcss");
    return prettier.format(code, { ...common, parser: "css", plugins: [postcss.default ?? postcss] });
  }
  if (lang === "js") {
    const [babel, estree] = await Promise.all([import("prettier/plugins/babel"), import("prettier/plugins/estree")]);
    return prettier.format(code, { ...common, parser: "babel", plugins: [babel.default ?? babel, estree.default ?? estree] });
  }
  if (lang === "html") {
    const [html, postcss, babel, estree] = await Promise.all([
      import("prettier/plugins/html"), import("prettier/plugins/postcss"), import("prettier/plugins/babel"), import("prettier/plugins/estree"),
    ]);
    return prettier.format(code, {
      ...common,
      parser: "html",
      htmlWhitespaceSensitivity: "css",
      plugins: [html.default ?? html, postcss.default ?? postcss, babel.default ?? babel, estree.default ?? estree],
    });
  }
  // PHP
  const php = await import("@prettier/plugin-php/standalone");
  return prettier.format(code, {
    ...common,
    parser: "php",
    plugins: [(php as { default?: unknown }).default ?? php],
    // plugin-php specific
    ...({ phpVersion: "8.2", braceStyle: "per-cs", trailingCommaPHP: true } as Record<string, unknown>),
  } as Parameters<typeof prettier.format>[1]);
}

export async function minify(code: string, lang: Lang, opts: { aggressiveHtml: boolean }): Promise<string> {
  const m = await import("./minify");
  if (lang === "json") return JSON.stringify(JSON.parse(code));
  if (lang === "css") return m.minifyCss(code);
  if (lang === "php") return m.minifyPhp(code);
  if (lang === "html") return m.minifyHtml(code, { aggressive: opts.aggressiveHtml, minifyInlineCss: true });
  const { minify: terser } = await import("terser");
  const r = await terser(code, { compress: true, mangle: true, format: { comments: /^!/ } });
  return r.code ?? "";
}

export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const loc = (err as Error & { loc?: { start?: { line: number; column: number } } }).loc?.start;
    const msg = err.message.split("\n")[0];
    return loc ? `Line ${loc.line}, column ${loc.column}: ${msg.replace(/\s*\(\d+:\d+\)\s*$/, "")}` : msg;
  }
  return String(err);
}
