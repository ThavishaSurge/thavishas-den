"use client";

import { useRef, useState } from "react";
import { FileArchive, Upload, X } from "lucide-react";

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  side: "before" | "after";
  file: File | null;
  onFile: (f: File | null) => void;
  /** Called when two ZIPs are dropped at once on either slab. */
  onPair: (files: File[]) => void;
  disabled?: boolean;
}

const COPY = {
  before: { title: "Before", hint: "The theme as it was — the original download or a backup from the server." },
  after: { title: "After", hint: "The theme with your changes — exported from your local or staging copy." },
};

export function DropSlab({ side, file, onFile, onPair, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (list: FileList | null) => {
    if (!list?.length) return;
    const zips = Array.from(list).filter((f) => /\.zip$/i.test(f.name) || f.type.includes("zip"));
    if (!zips.length) {
      setError(`${list[0].name} isn't a .zip file.`);
      return;
    }
    setError(null);
    if (zips.length >= 2) onPair(zips.slice(0, 2));
    else onFile(zips[0]);
  };

  return (
    <div
      className={`slab slab--${side}${over ? " slab--over" : ""}${file ? " slab--filled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) accept(e.dataTransfer.files);
      }}
    >
      <div className="slab__head">
        <span className="slab__title">{COPY[side].title}</span>
        {file && !disabled && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onFile(null)} aria-label={`Remove ${side} ZIP`}>
            <X size={14} />
          </button>
        )}
      </div>

      {file ? (
        <div className="slab__file">
          <FileArchive size={30} strokeWidth={1.5} className="slab__file-icon" />
          <div className="slab__file-text">
            <div className="slab__file-name" title={file.name}>{file.name}</div>
            <div className="slab__file-meta">{formatBytes(file.size)}</div>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={disabled}>
            Change
          </button>
        </div>
      ) : (
        <button type="button" className="slab__drop" onClick={() => input.current?.click()} disabled={disabled}>
          <Upload size={22} strokeWidth={1.6} />
          <span className="slab__drop-main">Drop a theme ZIP or browse</span>
          <span className="slab__drop-hint">{COPY[side].hint}</span>
        </button>
      )}
      {error && <p className="slab__error" role="alert">{error}</p>}

      <input
        ref={input}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="visually-hidden"
        tabIndex={-1}
        multiple
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
