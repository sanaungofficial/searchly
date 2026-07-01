"use client";

import {
  KANBAN_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  type KanbanStage,
} from "./workspace-data";
import { fontSans, type as T } from "@/lib/typography";

const INK = "#161616";

/** Bruddle stage pill — colored dot + label, sharp corners + ink border. */
export function PipelineStageBadge({
  stage,
  size = "md",
}: {
  stage: KanbanStage;
  size?: "md" | "lg";
}) {
  const stageColor = STAGE_COLORS[stage];
  const fontSize = size === "lg" ? T.bodySm : T.caption;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: size === "lg" ? "5px 12px 5px 10px" : "4px 10px 4px 8px",
        borderRadius: 0,
        border: `1.5px solid ${INK}`,
        background: `${stageColor}18`,
        color: INK,
        fontFamily: fontSans,
        fontSize,
        fontWeight: 600,
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          width: size === "lg" ? 8 : 7,
          height: size === "lg" ? 8 : 7,
          borderRadius: "50%",
          background: stageColor,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{STAGE_LABELS[stage]}</span>
    </span>
  );
}

/** Stage pill with native select overlay — for row actions and bulk updates. */
export function PipelineStagePicker({
  stage,
  onChange,
  disabled,
}: {
  stage: KanbanStage;
  onChange: (stage: KanbanStage) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex", maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
      <PipelineStageBadge stage={stage} size="lg" />
      <select
        value={stage}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as KanbanStage)}
        aria-label="Pipeline stage"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          width: "100%",
          height: "100%",
        }}
      >
        {KANBAN_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      {!disabled && (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: INK,
            pointerEvents: "none",
          }}
        >
          ▾
        </span>
      )}
    </div>
  );
}

/** Toolbar filter chip — toggles stage inclusion in table filter. */
export function PipelineStageFilterChip({
  stage,
  active,
  count,
  onToggle,
}: {
  stage: KanbanStage;
  active: boolean;
  count: number;
  onToggle: () => void;
}) {
  const stageColor = STAGE_COLORS[stage];
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 0,
        border: active ? `1.5px solid ${INK}` : "1.5px solid rgba(22,22,22,0.2)",
        background: active ? `${stageColor}22` : "#fff",
        boxShadow: active ? "2px 2px 0 #161616" : "none",
        fontFamily: fontSans,
        fontSize: T.caption,
        fontWeight: 600,
        color: INK,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: stageColor,
          flexShrink: 0,
        }}
      />
      {STAGE_LABELS[stage]}
      {count > 0 ? ` · ${count}` : ""}
    </button>
  );
}
