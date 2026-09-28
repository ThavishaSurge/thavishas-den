"use client";

import { useId, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { CopyButton } from "./CopyButton";

/* A set of small, consistent building blocks every tool uses. */

export function Panel({ title, actions, children, className = "", pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel${pad ? "" : " panel--flush"} ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          {title && <h2 className="panel__title">{title}</h2>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Grid({ children, cols = 2, className = "" }: { children: ReactNode; cols?: 2 | 3; className?: string }) {
  return <div className={`grid grid--${cols} ${className}`}>{children}</div>;
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`fld ${className}`}>
      <span className="fld__label">{label}</span>
      {children}
      {hint && <span className="fld__hint">{hint}</span>}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; wrapClass?: string };
export function TextInput({ label, hint, wrapClass, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} className={wrapClass}>
      <input className="inp" {...rest} />
    </Field>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; code?: boolean; wrapClass?: string };
export function TextArea({ label, hint, code = false, wrapClass, className = "", ...rest }: AreaProps) {
  const area = <textarea className={`inp inp--area${code ? " inp--code" : ""} ${className}`} spellCheck={code ? false : undefined} {...rest} />;
  if (!label) return area;
  return (
    <Field label={label} hint={hint} className={wrapClass}>
      {area}
    </Field>
  );
}

export function Select({ label, hint, options, wrapClass, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; options: (string | [string, string])[]; wrapClass?: string }) {
  return (
    <Field label={label} hint={hint} className={wrapClass}>
      <select className="inp" {...rest}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </Field>
  );
}

export function Check({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="chk">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="chk__label">{label}</span>
        {hint && <span className="chk__hint">{hint}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: ([T, string] | [T, string, ReactNode])[]; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text, icon]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`seg__opt${value === v ? " seg__opt--on" : ""}`} onClick={() => onChange(v)}>
          {icon}
          {text}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([v, label]) => (
        <button key={v} id={`${id}-${v}`} role="tab" aria-selected={value === v} className={`tabs__tab${value === v ? " tabs__tab--on" : ""}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Read-only code output with copy and optional download. */
export function Output({ value, filename, label, maxHeight, lang }: { value: string; filename?: string; label?: ReactNode; maxHeight?: number; lang?: string }) {
  return (
    <div className="out">
      <div className="out__head">
        <span className="out__label">{label}</span>
        <div className="out__actions">
          {filename && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadText(filename, value)}>
              <Download size={14} /> Download
            </button>
          )}
          <CopyButton text={value} />
        </div>
      </div>
      <pre className="out__pre" style={maxHeight ? { maxHeight } : undefined} data-lang={lang}>
        {value || " "}
      </pre>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  return <div className={`notice notice--${tone}`} role={tone === "error" ? "alert" : undefined}>{children}</div>;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}

/** Drag-and-drop or click-to-pick file input. */
export function FileDrop({ accept, multiple = false, onFiles, label, hint, icon }: { accept?: string; multiple?: boolean; onFiles: (files: File[]) => void; label: string; hint?: string; icon?: ReactNode }) {
  const [over, setOver] = useState(false);
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`drop${over ? " drop--over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      {icon}
      <span className="drop__label">{label}</span>
      {hint && <span className="drop__hint">{hint}</span>}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "add" | "rem" | "mod" | "move" }) {
  return (
    <div className={`kv${tone ? ` kv--${tone}` : ""}`}>
      <span className="kv__value">{value}</span>
      <span className="kv__label">{label}</span>
    </div>
  );
}
