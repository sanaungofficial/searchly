"use client";

import { assetTypeLabel, type UserAssetType } from "@/lib/asset-types";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export type UserAssetListItem = {
  id: string;
  type: UserAssetType;
  name: string;
  url: string;
  isPrimary?: boolean;
  createdAt: string;
  updatedAt?: string;
  targetJobTitle?: string | null;
  parseStatus?: "running" | "complete" | "failed" | null;
};

type Props = {
  assets: UserAssetListItem[];
  types?: UserAssetType[];
  showTypeBadge?: boolean;
  emptyMessage?: string;
  uploadLabel?: string;
  uploading?: boolean;
  onUpload?: () => void;
  onDelete?: (id: string) => void;
  onOpenResume?: (id: string) => void;
  isMobile?: boolean;
  compact?: boolean;
};

function resumeAnalysisBadge(asset: UserAssetListItem): { label: string; bg: string; border: string; color: string } {
  if (asset.parseStatus === "running") {
    return { label: "Analyzing…", bg: "#FFF8E8", border: "#E8D5A3", color: "#A08030" };
  }
  if (asset.parseStatus === "failed") {
    return { label: "Analysis failed", bg: "#FFF0F0", border: "#E8B4B4", color: "#A04040" };
  }
  if (asset.type === "RESUME" && asset.parseStatus === "complete") {
    return { label: "Analysis complete", bg: "#F0FFF8", border: "#A8DFC0", color: "#1A7A4A" };
  }
  return { label: "", bg: "", border: "", color: "" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function UserAssetsList({
  assets,
  types,
  showTypeBadge = false,
  emptyMessage = "No documents yet.",
  uploadLabel = "+ Add document",
  uploading = false,
  onUpload,
  onDelete,
  onOpenResume,
  isMobile = false,
  compact = false,
}: Props) {
  const filtered = types?.length ? assets.filter((a) => types.includes(a.type)) : assets;

  if (filtered.length === 0 && !onUpload) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{emptyMessage}</p>
    );
  }

  return (
    <div>
      {onUpload && (
        <div style={{ marginBottom: compact ? 12 : 16, display: "flex", justifyContent: "flex-end" }}>
          <ScoutPrimaryBtn onClick={onUpload} disabled={uploading} style={{ opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading…" : uploadLabel}
          </ScoutPrimaryBtn>
        </div>
      )}

      {filtered.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{emptyMessage}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 0 }}>
          {filtered.map((asset, index) => {
            const badge = asset.type === "RESUME" ? resumeAnalysisBadge(asset) : null;
            const canOpen = asset.type === "RESUME" && onOpenResume;

            return (
              <div
                key={asset.id}
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center",
                  gap: isMobile ? 10 : 12,
                  padding: compact ? "10px 12px" : "14px 16px",
                  background: compact ? surface.inset : undefined,
                  border: compact ? border.line : undefined,
                  borderRadius: compact ? "var(--scout-radius)" : undefined,
                  borderBottom: compact ? undefined : index < filtered.length - 1 ? border.line : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {canOpen ? (
                      <button
                        type="button"
                        onClick={() => onOpenResume!(asset.id)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: fontSans,
                          fontSize: T.bodySm,
                          fontWeight: 600,
                          color: color.forest,
                          textAlign: "left",
                        }}
                      >
                        {asset.name}
                      </button>
                    ) : (
                      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                        {asset.name}
                      </span>
                    )}
                    {showTypeBadge && (
                      <span
                        style={{
                          fontFamily: fontSans,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          background: "rgba(26,58,47,0.06)",
                          color: color.muted,
                          borderRadius: 4,
                        }}
                      >
                        {assetTypeLabel(asset.type)}
                      </span>
                    )}
                    {asset.isPrimary && (
                      <span
                        style={{
                          fontFamily: fontSans,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          background: color.forest,
                          color: "#fff",
                          borderRadius: 4,
                        }}
                      >
                        Primary
                      </span>
                    )}
                    {badge?.label && (
                      <span
                        style={{
                          fontFamily: fontSans,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          borderRadius: 4,
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                    Added {formatDate(asset.createdAt)}
                    {asset.targetJobTitle ? ` · Tailored for ${asset.targetJobTitle}` : ""}
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
                  <ScoutSecondaryBtn onClick={() => window.open(asset.url, "_blank", "noopener,noreferrer")}>
                    Download
                  </ScoutSecondaryBtn>
                  {onDelete && (
                    <ScoutSecondaryBtn
                      onClick={() => {
                        if (window.confirm(`Remove "${asset.name}"?`)) onDelete(asset.id);
                      }}
                    >
                      Remove
                    </ScoutSecondaryBtn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
