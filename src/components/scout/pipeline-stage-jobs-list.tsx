"use client";

import { useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import { companyLogoFromJobData } from "@/lib/cached-job";
import { STAGE_COLORS, STAGE_LABELS, type KanbanCard, type KanbanStage } from "./workspace-data";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { CompanyLogo } from "./company-logo";
import { fontSans, color, border, displayTitleStyle, surface, type as T } from "@/lib/typography";

function StageDropdown({
  stage,
  onChange,
}: {
  stage: KanbanStage;
  onChange: (s: KanbanStage) => void;
}) {
  const [open, setOpen] = useState(false);
  const stageColor = STAGE_COLORS[stage];
  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          padding: "6px 14px",
          background: surface.card,
          border: border.line,
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 600,
          color: stageColor,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageColor }} />
        {STAGE_LABELS[stage]} ▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              background: surface.card,
              border: border.line,
              zIndex: 100,
              minWidth: 150,
            }}
          >
            {(["saved", "applied", "interview", "offer", "closed"] as KanbanStage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: s === stage ? `${STAGE_COLORS[s]}10` : "transparent",
                  border: "none",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: s === stage ? 600 : 500,
                  color: s === stage ? STAGE_COLORS[s] : color.ink,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PipelineStageJobsList({
  stage,
  cards,
  onOpenDrawer,
  onChangeStage,
  onBackToRecommendations,
}: {
  stage: KanbanStage;
  cards: KanbanCard[];
  onOpenDrawer: (cardId: number) => void;
  onChangeStage: (cardId: number, stage: KanbanStage) => void;
  onBackToRecommendations: () => void;
}) {
  const stageCards = cards.filter((c) => c.stage === stage);
  const stageColor = STAGE_COLORS[stage];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <ScoutLabel>{STAGE_LABELS[stage]}</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0" }}>
            {stageCards.length} role{stageCards.length === 1 ? "" : "s"} in your pipeline
          </p>
        </div>
        <ScoutSecondaryBtn onClick={onBackToRecommendations}>← Back to Find roles</ScoutSecondaryBtn>
      </div>

      {!stageCards.length ? (
        <ScoutBox style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
            No roles in {STAGE_LABELS[stage].toLowerCase()} yet — save one from Find roles or paste a job URL.
          </p>
        </ScoutBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stageCards.map((card) => {
            const ext = card as KanbanCard & { _url?: string; _meta?: JobMeta };
            return (
              <ScoutBox key={card.id} stack padding={18} style={{ borderTop: `2px solid ${stageColor}` }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDrawer(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDrawer(card.id);
                    }
                  }}
                  style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
                >
                  <CompanyLogo {...companyLogoFromJobData(card.company, ext._meta)} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{card.role}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                      {card.company}
                      {ext._meta?.location ? ` · ${ext._meta.location}` : ""}
                      {card.days != null ? ` · ${card.days === 0 ? "Today" : `${card.days}d ago`}` : ""}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap" }}>
                  <StageDropdown stage={card.stage} onChange={(s) => onChangeStage(card.id, s)} />
                  {ext._url && (
                    <a
                      href={ext._url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline", alignSelf: "center" }}
                    >
                      Open posting ↗
                    </a>
                  )}
                </div>
              </ScoutBox>
            );
          })}
        </div>
      )}
    </div>
  );
}
