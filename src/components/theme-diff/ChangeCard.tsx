"use client";

import { MapPin } from "lucide-react";
import type { Change } from "@/lib/theme-diff/types";
import { describeChange } from "@/lib/theme-diff/export";
import { pairRuns } from "@/lib/theme-diff/wordDiff";
import { CodeBlock, type CodeRow } from "./CodeBlock";
import { CopyButton } from "../CopyButton";

const KIND_LABEL = { add: "Add", remove: "Remove", replace: "Replace" } as const;

export function ChangeCard({ change, index }: { change: Change; index: number }) {
  const pairs = change.kind === "replace" ? pairRuns(change.removed, change.added) : [];

  const removedRows: CodeRow[] = change.removed.map((text, i) => ({
    no: change.oldFrom + i, text, tone: "remove", segments: pairs[i]?.a,
  }));
  const addedRows: CodeRow[] = change.added.map((text, i) => ({
    no: change.newFrom + i, text, tone: "add", segments: pairs[i]?.b,
  }));

  return (
    <article className={`step step--${change.kind}`} id={`change-${index}`}>
      <header className="step__head">
        <span className="step__num">{index}</span>
        <div className="step__title">
          <h4>{describeChange(change)}</h4>
          {change.scope.length > 0 && (
            <div className="step__scope">
              {change.scope.map((s, i) => (
                <span key={i} className="step__scope-part">
                  <code>{s}</code>
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`chip ${change.kind === "add" ? "tone-add" : change.kind === "remove" ? "tone-remove" : "tone-change"}`}>
          {KIND_LABEL[change.kind]}
        </span>
      </header>

      {change.anchorAbove && (
        <div className="step__anchor">
          <MapPin size={14} />
          <span className="step__anchor-label">
            {change.anchorAboveNo ? `Find line ${change.anchorAboveNo}` : "Find"}
          </span>
          <code className="step__anchor-code">{change.anchorAbove.trim()}</code>
        </div>
      )}

      {change.removed.length > 0 && (
        <div className="step__block">
          <div className="step__block-head">
            <span>{change.kind === "replace" ? "Find and replace this" : "Delete this"}</span>
            <CopyButton text={change.removed.join("\n")} />
          </div>
          <CodeBlock rows={removedRows} />
        </div>
      )}

      {change.added.length > 0 && (
        <div className="step__block">
          <div className="step__block-head">
            <span>{change.kind === "replace" ? "With this" : "Paste this"}</span>
            <CopyButton text={change.added.join("\n")} label="Copy code" />
          </div>
          <CodeBlock rows={addedRows} />
        </div>
      )}

      {change.kind === "add" && change.anchorBelow && (
        <div className="step__anchor step__anchor--below">
          <span className="step__anchor-label">Before</span>
          <code className="step__anchor-code">{change.anchorBelow.trim()}</code>
        </div>
      )}
    </article>
  );
}
