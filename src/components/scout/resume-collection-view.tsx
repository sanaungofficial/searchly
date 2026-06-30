"use client";

import { useState } from "react";
import { HelpCircle, MoreHorizontal, Star } from "lucide-react";
import { RP } from "@/lib/resume-page-tokens";
import { formatRelativeTimeAgo } from "@/lib/format-relative-time";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ResumeCollectionAsset {
  id: string;
  name: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  targetJobTitle?: string | null;
  parseStatus?: "running" | "complete" | "failed" | null;
  parseError?: string | null;
  url?: string;
}

const MAX_RESUME_SLOTS = 5;

export function resumeAnalysisBadge(asset: ResumeCollectionAsset): { label: string; bg: string; border: string; color: string } {
  if (asset.parseStatus === "running") {
    return { label: "Analyzing…", bg: "#FFF8E8", border: "#E8D5A3", color: "#A08030" };
  }
  if (asset.parseStatus === "failed") {
    return { label: "Analysis failed", bg: "#FFF0F0", border: "#E8B4B4", color: "#A04040" };
  }
  return { label: "Analysis Complete", bg: RP.analysisCompleteBg, border: RP.mintBorder, color: RP.analysisCompleteText };
}

function gradeHexLetter(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch || "?";
}

function gradeHexColor(letter: string): { bg: string; border: string; text: string } {
  if (letter === "?") return { bg: "#F3F4F6", border: "#D1D5DB", text: "#9CA3AF" };
  if ("AB".includes(letter)) return { bg: RP.gradeGoldBg, border: RP.gradeGold, text: RP.gradeGoldText };
  if ("CD".includes(letter)) return { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" };
  return { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" };
}

export function ResumeCollectionView({
  assets,
  uploading,
  onUploadClick,
  onOpenResume,
  onMakePrimary,
  onDelete,
  onDownload,
}: {
  assets: ResumeCollectionAsset[];
  uploading?: boolean;
  onUploadClick: () => void;
  onOpenResume: (id: string) => void;
  onMakePrimary: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload?: (asset: ResumeCollectionAsset) => void;
}) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div style={{ paddingBottom: 40, fontFamily: "var(--font-ui), sans-serif" }}>
      <h1
        style={{
          margin: "0 0 16px",
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: 1.5,
          color: RP.text,
          textTransform: "uppercase",
        }}
      >
        Resume
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          marginBottom: 16,
          background: "#FFFFFF",
          borderRadius: RP.cardRadius,
          border: `1px solid ${RP.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>😊</span>
          <p style={{ margin: 0, fontSize: 13, color: RP.textMuted }}>
            You have {assets.length} resume{assets.length === 1 ? "" : "s"} saved out of {MAX_RESUME_SLOTS} available slots.
          </p>
          <HelpCircle size={14} color={RP.textMuted} />
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading || assets.length >= MAX_RESUME_SLOTS}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: "transparent",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            color: RP.text,
            cursor: uploading ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          {uploading ? "Uploading…" : "Add Resume"}
        </button>
      </div>

      <div
        style={{
          background: RP.panelBg,
          borderRadius: RP.cardRadius,
          border: `1px solid ${RP.border}`,
          overflow: "hidden",
        }}
      >
        {!isMobile && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 1fr 1fr 40px",
              gap: 12,
              padding: "12px 20px",
              background: RP.tableHeaderBg,
              borderBottom: `1px solid ${RP.border}`,
              fontSize: 12,
              fontWeight: 700,
              color: RP.textMuted,
            }}
          >
            <span>Resume</span>
            <span>Target Job Title</span>
            <span>Last Modified</span>
            <span>Created</span>
            <span />
          </div>
        )}

        {assets.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: RP.textMuted }}>
              No resume yet — upload one to unlock fit scores and tailoring.
            </p>
            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploading}
              style={{
                padding: "12px 24px",
                background: RP.mint,
                border: "none",
                borderRadius: RP.ctaPrimaryRadius,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                color: RP.text,
              }}
            >
              {uploading ? "Uploading…" : "+ Upload resume"}
            </button>
          </div>
        ) : (
          assets.map((asset, index) => {
            const badge = resumeAnalysisBadge(asset);
            const letter = gradeHexLetter(asset.name);
            const hex = gradeHexColor(letter);
            const lastMod = formatRelativeTimeAgo(asset.updatedAt) ?? "—";
            const created = formatRelativeTimeAgo(asset.createdAt) ?? "—";

            return (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenResume(asset.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenResume(asset.id);
                  }
                }}
                style={{
                  display: isMobile ? "block" : "grid",
                  gridTemplateColumns: isMobile ? undefined : "2fr 1.2fr 1fr 1fr 40px",
                  gap: 12,
                  alignItems: "center",
                  padding: isMobile ? "16px" : "16px 20px",
                  borderBottom: index < assets.length - 1 ? `1px solid ${RP.border}` : "none",
                  cursor: "pointer",
                  background: RP.panelBg,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, marginBottom: isMobile ? 10 : 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)",
                      background: hex.bg,
                      border: `2px solid ${hex.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontWeight: 800,
                      fontSize: 14,
                      color: hex.text,
                    }}
                  >
                    {letter}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: RP.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {asset.name}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {asset.isPrimary && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            background: RP.primaryBadgeBg,
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            color: RP.primaryBadgeText,
                            letterSpacing: 0.3,
                          }}
                        >
                          <Star size={10} fill={RP.mint} color={RP.mint} />
                          PRIMARY
                        </span>
                      )}
                      <span
                        style={{
                          padding: "2px 8px",
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </div>

                {isMobile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: RP.textMuted }}>
                    <span>Target: {asset.targetJobTitle || "—"}</span>
                    <span>Modified: {lastMod}</span>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: RP.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {asset.targetJobTitle || "—"}
                    </span>
                    <span style={{ fontSize: 13, color: RP.textMuted }}>{lastMod}</span>
                    <span style={{ fontSize: 13, color: RP.textMuted }}>{created}</span>
                  </>
                )}

                <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label="Resume options"
                    onClick={() => setMenuOpen(menuOpen === asset.id ? null : asset.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: RP.textMuted }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen === asset.id && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        background: RP.panelBg,
                        border: `1px solid ${RP.border}`,
                        borderRadius: 8,
                        minWidth: 160,
                        zIndex: 20,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                        overflow: "hidden",
                      }}
                    >
                      {[
                        { label: "View resume", action: () => { onOpenResume(asset.id); setMenuOpen(null); } },
                        ...(onDownload && asset.url ? [{ label: "Download", action: () => { onDownload(asset); setMenuOpen(null); } }] : []),
                        ...(!asset.isPrimary ? [{ label: "Make primary", action: () => { onMakePrimary(asset.id); setMenuOpen(null); } }] : []),
                        { label: "Delete", action: () => { onDelete(asset.id); setMenuOpen(null); } },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.action}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: `1px solid ${RP.border}`,
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
