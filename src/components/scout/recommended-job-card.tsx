"use client";

import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import type { RoleListing } from "@/lib/role-listings";
import { roleListingToVectorMatchedJob } from "@/lib/role-listings";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { companyLogoFromJobData } from "@/lib/cached-job";
import { formatRelativeTimeAgo } from "@/lib/format-relative-time";
import { CompanyLogo } from "./company-logo";
import { MatchScoreColumn } from "@/components/scout/match-why-score-ui";
import { JR } from "@/lib/opportunities-jobright-tokens";
import { fontSans, type as T } from "@/lib/typography";
import { BRUDDLE_BTN_CLASS, scoutPrimaryCtaStyle } from "./scout-box";

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5c0 2.625 3.5 6.5 3.5 6.5s3.5-3.875 3.5-6.5c0-1.93-1.57-3.5-3.5-3.5Z" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="7" cy="5" r="1.25" fill="currentColor" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="4.5" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5 4.5V3.5a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 6.5L7 1.5L12.5 6.5V12.5H9V9.5H5V12.5H1.5V6.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 10h11L11 4.5 8.5 7 7 3.5 5.5 7 3 4.5 1.5 10Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7 3.5V10.5M5.5 9C5.5 9 6 10 7 10C8 10 8.5 9 8.5 8.25C8.5 7 7 7 7 7C7 7 5.5 7 5.5 5.75C5.5 5 6 4.5 7 4.5C8 4.5 8.5 5.5 8.5 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <line x1="1.5" y1="6" x2="12.5" y2="6" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function MetaCell({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ display: "flex", flexShrink: 0, color: JR.textSecondary, opacity: 0.85 }}>{icon}</span>
      <span
        style={{
          fontFamily: fontSans,
          fontSize: JR.bodySize,
          color: JR.textSecondary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function companySubtitle(row: RoleListing): string | null {
  const c = row.cached;
  const industry = c.industries?.[0] ?? c.subindustries?.[0] ?? c.department;
  if (!industry) return null;
  return `${row.companyName} / ${industry}`;
}

function workModelLabel(row: RoleListing): string | null {
  const c = row.cached;
  if (c.locationType) {
    if (c.locationType === "In-Person") return "Onsite";
    return c.locationType;
  }
  if (c.remote) return "Remote";
  return null;
}

function seniorityLabel(row: RoleListing): string | null {
  return row.cached.seniority ?? row.cached.experienceLevel ?? null;
}

function buildMetaGrid(row: RoleListing): { icon: ReactNode; label: string }[] {
  const c = row.cached;
  const items: { icon: React.ReactNode; label: string }[] = [];
  const location = row.location ?? c.location;
  if (location) items.push({ icon: <IconPin />, label: location });
  const workModel = workModelLabel(row);
  if (workModel) items.push({ icon: <IconHome />, label: workModel });
  if (c.jobType) items.push({ icon: <IconBriefcase />, label: c.jobType.replace("Full Time", "Full-time").replace("Part Time", "Part-time") });
  const seniority = seniorityLabel(row);
  if (seniority) items.push({ icon: <IconCrown />, label: seniority });
  if (c.salary) items.push({ icon: <IconDollar />, label: c.salary });
  if (c.experienceLevel && c.experienceLevel !== seniority) {
    items.push({ icon: <IconCalendar />, label: c.experienceLevel });
  }
  return items;
}

function postedBadgeText(row: RoleListing): string | null {
  const iso = row.cached.datePosted;
  if (iso) {
    const relative = formatRelativeTimeAgo(iso);
    if (relative) return relative;
  }
  return null;
}

function isRecentPost(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < 4 * 24 * 60 * 60 * 1000;
}

export function RecommendedJobCard({
  row,
  savingKey,
  onOpenRecommended,
  onSaveJob,
  setSavingKey,
}: {
  row: RoleListing;
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  setSavingKey: (key: string | null) => void;
}) {
  const handleOpen = () => onOpenRecommended(roleListingToVectorMatchedJob(row));

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const matchJob = roleListingToVectorMatchedJob(row);
    setSavingKey(row.dedupeKey);
    onSaveJob(matchJob).finally(() => setSavingKey(null));
  };

  const isSaving = savingKey === row.dedupeKey;
  const matchScore = row.matchScore ?? 0;
  const matchLabel = row.matchLabel ?? "";
  const postedText = postedBadgeText(row);
  const recent = isRecentPost(row.cached.datePosted);
  const subtitle = companySubtitle(row);
  const metaItems = buildMetaGrid(row);

  return (
    <div
      style={{
        display: "flex",
        background: JR.cardBg,
        borderRadius: JR.cardRadius,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
          style={{ flex: 1, padding: "16px 16px 12px", cursor: "pointer" }}
        >
          {(postedText || row.isTrackedCompany) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {postedText && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    fontSize: T.label,
                    fontWeight: 500,
                    color: JR.text,
                    background: recent ? JR.mintTint : "rgba(0,0,0,0.04)",
                    borderRadius: JR.badgeRadius,
                    whiteSpace: "nowrap",
                  }}
                >
                  {postedText}
                </span>
              )}
              {row.isTrackedCompany && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    fontSize: T.label,
                    fontWeight: 600,
                    color: JR.text,
                    background: JR.mintTintStrong,
                    border: `1px solid ${JR.mintBorder}`,
                    borderRadius: JR.badgeRadius,
                    whiteSpace: "nowrap",
                  }}
                >
                  Watchlist
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <CompanyLogo {...companyLogoFromJobData(row.companyName, row.cached)} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: JR.titleSize,
                  fontWeight: JR.titleWeight,
                  color: JR.text,
                  margin: "0 0 4px",
                  lineHeight: 1.2,
                }}
              >
                {row.title}
              </p>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: JR.bodySize,
                  fontWeight: 600,
                  color: JR.text,
                  margin: "0 0 10px",
                }}
              >
                {subtitle ?? row.companyName}
              </p>
              {metaItems.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "8px 12px",
                  }}
                >
                  {metaItems.map(({ icon, label }, i) => (
                    <MetaCell key={i} icon={icon} label={label} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "0 16px 14px",
            flexWrap: "wrap",
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              aria-label={isSaving ? "Saving job" : "Save job"}
              title={isSaving ? "Saving…" : "Save job"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                padding: 0,
                background: "transparent",
                border: `1px solid ${JR.border}`,
                borderRadius: "var(--scout-radius)",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.5 : 1,
                color: JR.text,
              }}
            >
              <Heart size={16} strokeWidth={1.75} />
            </button>
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontFamily: fontSans,
                  fontSize: JR.labelSize,
                  color: JR.textMuted,
                  textDecoration: "none",
                }}
              >
                Open posting ↗
              </a>
            )}
          </div>
          <button
            type="button"
            className={BRUDDLE_BTN_CLASS}
            onClick={handleOpen}
            style={{
              padding: "6px 16px",
              ...scoutPrimaryCtaStyle,
              fontFamily: fontSans,
              fontSize: JR.bodySize,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            View role
          </button>
        </div>
      </div>

      {matchScore > 0 && (
        <MatchScoreColumn
          score={matchScore}
          label={matchLabel}
          reasons={row.matchReasons ?? []}
          matchedSkills={row.matchedSkills ?? []}
          width={108}
        />
      )}
    </div>
  );
}
