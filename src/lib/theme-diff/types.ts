/* Shared types for the Theme Diff engine and UI. */

export type FileStatus =
  | "modified"
  | "added"
  | "removed"
  | "renamed"
  | "unchanged";

export type ChangeKind = "add" | "remove" | "replace";

export type Recommendation =
  | "apply-edits"
  | "replace-file"
  | "upload-new"
  | "delete-file"
  | "move-file"
  | "move-and-edit"
  | "none";

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreLineEndings: boolean;
  context: number;
  /** Glob-ish patterns, one per entry. `**` matches across folders. */
  exclude: string[];
  /** Also list files that did not change. */
  includeUnchanged: boolean;
}

export const DEFAULT_EXCLUDES = [
  "__MACOSX/**",
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/.git/**",
  "**/node_modules/**",
];

export const DEFAULT_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreLineEndings: true,
  context: 3,
  exclude: DEFAULT_EXCLUDES,
  includeUnchanged: false,
};

export interface DiffLine {
  type: "context" | "add" | "remove";
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/** A single human-readable edit instruction inside a file. */
export interface Change {
  id: string;
  kind: ChangeKind;
  /** Lines in the original ("before") file that this change touches. */
  oldFrom: number;
  oldTo: number;
  /** Lines in the updated ("after") file that this change produces. */
  newFrom: number;
  newTo: number;
  /** For adds: the before-file line number the code goes after (0 = top of file). */
  insertAfter: number;
  removed: string[];
  added: string[];
  /** Nearest unchanged line above the change, used to find the spot. */
  anchorAbove: string | null;
  anchorAboveNo: number | null;
  /** Nearest unchanged line below the change. */
  anchorBelow: string | null;
  /** Enclosing function / selector / block, outermost first. */
  scope: string[];
}

export interface Highlight {
  tone: "add" | "remove" | "change" | "info";
  text: string;
}

export interface FileResult {
  path: string;
  /** Previous path for renamed/moved files. */
  fromPath?: string;
  status: FileStatus;
  binary: boolean;
  language: string;
  sizeBefore: number | null;
  sizeAfter: number | null;
  linesAdded: number;
  linesRemoved: number;
  /** Only line endings or whitespace changed (under the chosen options). */
  cosmeticOnly?: "whitespace" | "line-endings";
  minified: boolean;
  /** Share of the original file that changed, 0–1. */
  churn: number;
  /** Share of the original lines kept, 0–1 (text files). */
  similarity?: number;
  recommendation: Recommendation;
  changes: Change[];
  hunks: Hunk[];
  highlights: Highlight[];
  /** Full text for added / removed text files (so they can be viewed & copied). */
  content?: string;
  /** Unified patch text for this file (text files only). */
  patch?: string;
  /** Path of this file inside the uploaded after-ZIP (with root folder). */
  afterZipPath?: string;
  /** Path of this file inside the uploaded before-ZIP (with root folder). */
  beforeZipPath?: string;
  /** The diff was too large or slow to compute line-by-line. */
  tooLarge?: boolean;
}

export interface ThemeMeta {
  name?: string;
  version?: string;
  kind?: string;
}

export interface Report {
  createdAt: string;
  beforeName: string;
  afterName: string;
  beforeRoot: string | null;
  afterRoot: string | null;
  beforeMeta: ThemeMeta;
  afterMeta: ThemeMeta;
  options: DiffOptions;
  totals: {
    filesBefore: number;
    filesAfter: number;
    modified: number;
    added: number;
    removed: number;
    renamed: number;
    unchanged: number;
    excluded: number;
    linesAdded: number;
    linesRemoved: number;
    changes: number;
  };
  files: FileResult[];
  durationMs: number;
}

export type Progress = {
  phase: "reading" | "comparing" | "finishing";
  done: number;
  total: number;
  label?: string;
};

export type WorkerRequest = {
  before: ArrayBuffer;
  after: ArrayBuffer;
  beforeName: string;
  afterName: string;
  options: DiffOptions;
};

export type WorkerResponse =
  | { type: "progress"; progress: Progress }
  | { type: "done"; report: Report }
  | { type: "error"; message: string };
