"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import {
  DEFAULT_VECTOR_SEARCH_FILTERS,
  HIREBASE_COMPANY_SIZE_BUCKETS,
  HIREBASE_EXPERIENCE_LEVELS,
  HIREBASE_JOB_TYPES,
  HIREBASE_LOCATION_TYPES,
  VECTOR_SEARCH_RESULTS_MAX,
  type VectorMatchedJob,
  type VectorSearchFilters,
} from "@/lib/vector-matched-job";
import { cachedJobToMeta } from "@/lib/cached-job";
import {
  filterRoleListings,
  mergeRoleListings,
  roleListingToVectorMatchedJob,
  type RoleListing,
  type StageFilter,
} from "@/lib/role-listings";
import { STAGE_COLORS, STAGE_LABELS, type KanbanCard, type KanbanStage } from "./workspace-data";
import {
  filtersCacheKey,
  isCacheFresh,
  readRecommendedCache,
  writeRecommendedCache,
} from "@/lib/recommended-jobs-cache";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { isLowQualityMatchReason, matchScoreStyle } from "@/lib/match-score";

type JobsApiResponse = {
  jobs?: VectorMatchedJob[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  matchMode?: string;
  needsResume?: boolean;
  error?: string;
};

const SEMANTIC_QUERY_STORAGE_KEY = "kimchi_pipeline_semantic_query";

const COMMON_COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "India", "Singapore"];

const US_STATES = [
  "California", "New York", "Texas", "Washington", "Massachusetts", "Illinois", "Colorado", "Georgia", "Florida", "Virginia",
];

function MatchScoreBadge({ score, label }: { score: number; label: string }) {
  const style = matchScoreStyle(score);
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div
        style={{
          width: 52,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: style.bg,
          border: `2px solid ${style.accent}`,
        }}
      >
        <span style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: style.accent, lineHeight: 1 }}>{score}</span>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: style.accent, margin: "6px 0 0", letterSpacing: "0.02em" }}>
        {label}
      </p>
    </div>
  );
}

function splitInputList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function loadStoredSemanticQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SEMANTIC_QUERY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function filtersToForm(f: VectorSearchFilters) {
  return {
    semanticQuery: f.semanticQuery ?? "",
    jobTitles: (f.jobTitles ?? []).join(", "),
    keywords: (f.keywords ?? []).join(", "),
    companyName: f.companyName ?? "",
    industries: (f.industries ?? []).join(", "),
    subindustries: (f.subindustries ?? []).join(", "),
    jobCategories: (f.jobCategories ?? []).join(", "),
    locationCity: f.locations?.[0]?.city ?? "",
    locationRegion: f.locations?.[0]?.region ?? "",
    locationCountry: f.locations?.[0]?.country ?? "",
    datePostedFrom: f.datePostedFrom ?? "",
    salaryFrom: f.salaryFrom != null ? String(f.salaryFrom) : "",
    salaryTo: f.salaryTo != null ? String(f.salaryTo) : "",
    yearsFrom: f.yearsFrom != null ? String(f.yearsFrom) : "",
    yearsTo: f.yearsTo != null ? String(f.yearsTo) : "",
    jobBoard: f.jobBoard ?? "",
    locationTypes: new Set(f.locationTypes ?? []),
    jobTypes: new Set(f.jobTypes ?? []),
    experienceLevels: new Set(f.experienceLevels ?? []),
    companySizeBuckets: new Set(f.companySizeBuckets ?? []),
    visaSponsored: f.visaSponsored === true,
  };
}

type FilterForm = ReturnType<typeof filtersToForm>;

function formToFilters(form: FilterForm, page: number): VectorSearchFilters {
  const locationParts = [form.locationCity, form.locationRegion, form.locationCountry].filter(Boolean);
  return {
    ...DEFAULT_VECTOR_SEARCH_FILTERS,
    page,
    limit: VECTOR_SEARCH_RESULTS_MAX,
    semanticQuery: form.semanticQuery.trim() || undefined,
    jobTitles: splitInputList(form.jobTitles),
    keywords: splitInputList(form.keywords),
    companyName: form.companyName.trim() || undefined,
    industries: splitInputList(form.industries),
    subindustries: splitInputList(form.subindustries),
    jobCategories: splitInputList(form.jobCategories),
    jobBoard: form.jobBoard.trim() || undefined,
    locationTypes: [...form.locationTypes],
    jobTypes: [...form.jobTypes],
    experienceLevels: [...form.experienceLevels],
    companySizeBuckets: [...form.companySizeBuckets],
    visaSponsored: form.visaSponsored || undefined,
    datePostedFrom: form.datePostedFrom.trim() || undefined,
    salaryFrom: form.salaryFrom.trim() ? Number(form.salaryFrom) : undefined,
    salaryTo: form.salaryTo.trim() ? Number(form.salaryTo) : undefined,
    yearsFrom: form.yearsFrom.trim() ? Number(form.yearsFrom) : undefined,
    yearsTo: form.yearsTo.trim() ? Number(form.yearsTo) : undefined,
    locations: locationParts.length
      ? [{ city: form.locationCity.trim() || undefined, region: form.locationRegion.trim() || undefined, country: form.locationCountry.trim() || undefined }]
      : undefined,
  };
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  borderRadius: 0,
  fontFamily: fontSans,
  fontSize: T.caption,
  boxSizing: "border-box",
  background: surface.card,
};

function FilterSectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ gridColumn: "1 / -1", marginBottom: 4 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.forest, margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: 0, lineHeight: 1.45 }}>{hint}</p>
    </div>
  );
}

function DatalistInput({
  value,
  onChange,
  listId,
  options,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  listId: string;
  options: string[];
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <>
      <input
        type={type}
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={options.length ? listId : undefined}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </>
  );
}

function MatchFitCallout({ job }: { job: VectorMatchedJob }) {
  const reasons = job.matchReasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, 3);
  if (!reasons.length) return null;

  const score = matchScoreStyle(job.matchScore);
  const matchedSkills = job.matchedSkills?.slice(0, 6) ?? [];

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: score.bgSubtle,
        borderLeft: `2px solid ${score.accent}`,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: score.accent,
          margin: "0 0 4px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        Why you&apos;re a good fit
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: score.accent }}>{job.matchLabel}</span>
        {" "}· {job.matchScore}/100 from your profile
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {reasons.map((reason) => (
          <li key={reason} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontFamily: fontSans, fontSize: T.caption, color: color.ink, lineHeight: 1.5 }}>
            <span aria-hidden style={{ flexShrink: 0, color: score.accent, fontWeight: 700, marginTop: 1 }}>→</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      {matchedSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {matchedSkills.map((skill) => (
            <span
              key={skill}
              style={{
                padding: "3px 8px",
                background: score.bg,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 500,
                color: score.accent,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        border: active ? border.lineStrong : border.line,
        background: active ? surface.inset : surface.card,
        color: active ? color.forest : color.muted,
        fontFamily: fontSans,
        fontSize: T.label,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function JobFiltersGrid({
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
}: {
  form: FilterForm;
  setForm: React.Dispatch<React.SetStateAction<FilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 16px", marginTop: 8, paddingTop: 16, borderTop: border.line }}>
      <FilterSectionHeader
        title="Type to filter"
        hint="Free text — matches job title, company, location, and description. Separate multiple job titles or keywords with commas."
      />
      <FilterField label="Job titles">
        <input style={inputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="Strategy Manager, VP Operations" />
      </FilterField>
      <FilterField label="Keywords">
        <input style={inputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="remote, B2B SaaS" />
      </FilterField>
      <FilterField label="Company">
        <DatalistInput
          value={form.companyName}
          onChange={(companyName) => setForm((f) => ({ ...f, companyName }))}
          listId="recommended-company-suggestions"
          options={trackedCompanyNames}
          placeholder={trackedCompanyNames.length ? "Pick a tracked company or type any name" : "Stripe"}
        />
      </FilterField>
      <FilterField label="City">
        <input style={inputStyle} value={form.locationCity} onChange={(e) => setForm((f) => ({ ...f, locationCity: e.target.value }))} placeholder="San Francisco" />
      </FilterField>
      <FilterField label="State / region">
        <DatalistInput
          value={form.locationRegion}
          onChange={(locationRegion) => setForm((f) => ({ ...f, locationRegion }))}
          listId="recommended-region-suggestions"
          options={US_STATES}
          placeholder="California"
        />
      </FilterField>
      <FilterField label="Country">
        <DatalistInput
          value={form.locationCountry}
          onChange={(locationCountry) => setForm((f) => ({ ...f, locationCountry }))}
          listId="recommended-country-suggestions"
          options={COMMON_COUNTRIES}
          placeholder="United States"
        />
      </FilterField>
      <FilterField label="Posted after">
        <input type="date" style={inputStyle} value={form.datePostedFrom} onChange={(e) => setForm((f) => ({ ...f, datePostedFrom: e.target.value }))} />
      </FilterField>

      <FilterSectionHeader
        title="Select options"
        hint="Tap to toggle — these use fixed Hirebase categories (work arrangement, job type, seniority, company size)."
      />
      <div style={{ gridColumn: "1 / -1" }}>
        <FilterField label="Work arrangement">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_LOCATION_TYPES.map((t) => (
              <ChipToggle key={t} label={t} active={form.locationTypes.has(t)} onClick={() => setForm((f) => ({ ...f, locationTypes: toggleSet(f.locationTypes, t) }))} />
            ))}
          </div>
        </FilterField>
        <FilterField label="Employment type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_JOB_TYPES.map((t) => (
              <ChipToggle key={t} label={t} active={form.jobTypes.has(t)} onClick={() => setForm((f) => ({ ...f, jobTypes: toggleSet(f.jobTypes, t) }))} />
            ))}
          </div>
        </FilterField>
        <FilterField label="Experience level">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_EXPERIENCE_LEVELS.map((t) => (
              <ChipToggle key={t} label={t} active={form.experienceLevels.has(t)} onClick={() => setForm((f) => ({ ...f, experienceLevels: toggleSet(f.experienceLevels, t) }))} />
            ))}
          </div>
        </FilterField>
        <FilterField label="Company size (employees)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_COMPANY_SIZE_BUCKETS.map((t) => (
              <ChipToggle key={t} label={t} active={form.companySizeBuckets.has(t)} onClick={() => setForm((f) => ({ ...f, companySizeBuckets: toggleSet(f.companySizeBuckets, t) }))} />
            ))}
          </div>
        </FilterField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: T.caption, color: color.ink, cursor: "pointer" }}>
          <input type="checkbox" checked={form.visaSponsored} onChange={(e) => setForm((f) => ({ ...f, visaSponsored: e.target.checked }))} />
          Visa sponsorship only
        </label>
      </div>
    </div>
  );
}

function RecommendedLoadingSkeleton({ message }: { message: string }) {
  const barWidths = ["72%", "58%", "84%", "64%"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ScoutBox style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color.forest,
            animation: "pulse 1.2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{message}</p>
      </ScoutBox>
      {[0, 1, 2].map((card) => (
        <ScoutBox key={card} padding={18}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: "#F0EDE8",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${card * 0.15}s`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              {barWidths.map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: i === 0 ? 18 : 12,
                    width: w,
                    marginBottom: i === 0 ? 10 : 8,
                    background: "#F0EDE8",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${card * 0.15 + i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </ScoutBox>
      ))}
    </div>
  );
}

export function buildRecommendedProspectCard(
  job: VectorMatchedJob,
  drawerId: number
): KanbanCard & { _url?: string; _meta?: JobMeta } {
  const meta: JobMeta = {
    ...cachedJobToMeta(job),
    vectorMatch: {
      matchScore: job.matchScore,
      matchLabel: job.matchLabel,
      matchReasons: job.matchReasons,
      matchedSkills: job.matchedSkills,
      gapSkills: job.gapSkills,
      vectorRank: job.vectorRank,
    },
  };
  return {
    id: drawerId,
    company: job.companyName,
    initials: job.companyName.slice(0, 2).toUpperCase(),
    role: job.title,
    stage: "saved",
    fit: job.matchScore,
    jobRef: null,
    days: 0,
    _url: job.url ?? undefined,
    _meta: meta,
  };
}

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
          borderRadius: 0,
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 600,
          color: stageColor,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageColor, flexShrink: 0 }} />
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
              boxShadow: "3px 3px 0 rgba(17,17,17,0.06)",
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

function UnifiedRoleResultsList({
  listings,
  savingKey,
  onOpenRecommended,
  onOpenPipeline,
  onSaveJob,
  onChangeStage,
  setSavingKey,
  emptyMessage,
}: {
  listings: RoleListing[];
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onOpenPipeline: (cardId: number) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  onChangeStage: (cardId: number, stage: KanbanStage) => void;
  setSavingKey: (key: string | null) => void;
  emptyMessage: string;
}) {
  if (!listings.length) {
    return (
      <ScoutBox style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>{emptyMessage}</p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {listings.map((row) => {
        const inPipeline = row.pipelineCardId != null;
        const matchJob = row.matchScore != null && row.matchScore > 0 ? roleListingToVectorMatchedJob(row) : null;
        const score = matchScoreStyle(row.matchScore ?? 0);
        const borderColor = inPipeline && row.stage ? STAGE_COLORS[row.stage] : score.accent;

        const handleOpen = () => {
          if (inPipeline && row.pipelineCardId != null) {
            onOpenPipeline(row.pipelineCardId);
          } else {
            onOpenRecommended(roleListingToVectorMatchedJob(row));
          }
        };

        return (
          <ScoutBox key={row.dedupeKey} stack padding={18} style={{ borderTop: `2px solid ${borderColor}` }}>
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
              style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
            >
              <CompanyLogo name={row.companyName} website={row.url} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{row.title}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px" }}>
                      {row.companyName}
                      {row.location ? ` · ${row.location}` : ""}
                      {inPipeline && row.days != null ? ` · ${row.days === 0 ? "Today" : `${row.days}d ago`}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {inPipeline && row.stage ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            border: border.line,
                            fontFamily: fontSans,
                            fontSize: T.label,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: STAGE_COLORS[row.stage],
                            background: `${STAGE_COLORS[row.stage]}14`,
                          }}
                        >
                          {STAGE_LABELS[row.stage]}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            border: border.line,
                            fontFamily: fontSans,
                            fontSize: T.label,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: score.accent,
                            background: score.bgSubtle,
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                  {matchJob && matchJob.matchScore > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <ScoreExplainerPopover variant="vector-match" align="right" />
                      <MatchScoreBadge score={matchJob.matchScore} label={matchJob.matchLabel} />
                    </div>
                  )}
                </div>
                {matchJob && matchJob.matchScore > 0 && <MatchFitCallout job={matchJob} />}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap", alignItems: "center" }}>
              {inPipeline && row.pipelineCardId != null && row.stage ? (
                <StageDropdown
                  stage={row.stage}
                  onChange={(s) => onChangeStage(row.pipelineCardId!, s)}
                />
              ) : (
                <ScoutPrimaryBtn
                  onClick={(e) => {
                    e.stopPropagation();
                    const saveKey = row.dedupeKey;
                    setSavingKey(saveKey);
                    onSaveJob(roleListingToVectorMatchedJob(row)).finally(() => setSavingKey(null));
                  }}
                  disabled={savingKey === row.dedupeKey}
                >
                  {savingKey === row.dedupeKey ? "Saving…" : "Save to pipeline"}
                </ScoutPrimaryBtn>
              )}
              {row.url && (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
                >
                  Open posting ↗
                </a>
              )}
            </div>
          </ScoutBox>
        );
      })}
    </div>
  );
}

export function PipelineRecommendedSection({
  pipelineCards,
  stageFilter,
  onStageFilterChange,
  onOpenJob,
  onOpenPipeline,
  onSaveJob,
  onChangeStage,
}: {
  pipelineCards: KanbanCard[];
  stageFilter: StageFilter;
  onStageFilterChange: (filter: StageFilter) => void;
  onOpenJob: (job: VectorMatchedJob) => void;
  onOpenPipeline: (cardId: number) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  onChangeStage: (cardId: number, stage: KanbanStage) => void;
}) {
  const [form, setForm] = useState(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: loadStoredSemanticQuery(),
  }));
  const [appliedForm, setAppliedForm] = useState<FilterForm>(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: "",
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [jobs, setJobs] = useState<VectorMatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchScoped, setSearchScoped] = useState(true);
  const [trackedCompanyNames, setTrackedCompanyNames] = useState<string[]>([]);

  const mountedRef = useRef(false);
  const fetchGenRef = useRef(0);

  const hasActiveSearch = Boolean(appliedForm.semanticQuery.trim());

  const fetchRecommended = useCallback(
    async (filtersForm: FilterForm, options?: { forceRefresh?: boolean; preferCache?: boolean; background?: boolean }) => {
      const filters = formToFilters(filtersForm, 1);
      const cacheKey = filtersCacheKey(filters);
      const forceRefresh = options?.forceRefresh === true;
      const background = options?.background === true;
      const gen = ++fetchGenRef.current;

      if (!background) {
        setLoading(true);
        setError(null);
      } else {
        setRevalidating(true);
      }

      const semanticQuery = filtersForm.semanticQuery.trim();
      if (semanticQuery) {
        try {
          localStorage.setItem(SEMANTIC_QUERY_STORAGE_KEY, semanticQuery);
        } catch {
          /* ignore */
        }
      }

      try {
        const res = await fetch("/api/jobs/recommended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...filters,
            preferCache: options?.preferCache ?? !forceRefresh,
            forceRefresh,
          }),
        });
        const data = (await res.json()) as JobsApiResponse;
        if (gen !== fetchGenRef.current) return;

        if (!res.ok) {
          const msg = formatApiErrorMessage(data.error, "Could not load recommended jobs.");
          setError(
            data.needsResume
              ? `${msg} Upload or re-upload your resume from Profile → Assets.`
              : msg,
          );
          if (!background) setJobs([]);
          writeRecommendedCache({
            jobs: [],
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            error: msg,
          });
        } else {
          const nextJobs = data.jobs ?? [];
          setJobs(nextJobs);
          setError(null);
          setSearchScoped(data.matchMode === "resume" || data.matchMode === "semantic_scoped");
          writeRecommendedCache({
            jobs: nextJobs,
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            matchMode: data.matchMode,
            error: null,
          });
        }
        setHasLoadedOnce(true);
      } catch {
        if (gen !== fetchGenRef.current) return;
        setError("Network error — try again.");
        if (!background) setJobs([]);
        setHasLoadedOnce(true);
      } finally {
        if (gen === fetchGenRef.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetch("/api/companies")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ name?: string }>) => {
        const names = [...new Set((Array.isArray(data) ? data : []).map((c) => c.name?.trim()).filter(Boolean) as string[])].sort();
        setTrackedCompanyNames(names);
      })
      .catch(() => {
        /* optional suggestions */
      });
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const defaultForm: FilterForm = {
      ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
      semanticQuery: "",
    };
    const defaultFilters = formToFilters(defaultForm, 1);
    const cacheKey = filtersCacheKey(defaultFilters);
    const cached = readRecommendedCache(cacheKey);

    if (cached?.jobs?.length) {
      setJobs(cached.jobs);
      setHasLoadedOnce(true);
      setLoading(false);
      if (isCacheFresh(cached)) return;
      void fetchRecommended(defaultForm, { background: true, preferCache: true });
      return;
    }

    if (cached && isCacheFresh(cached)) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void fetchRecommended(defaultForm, { preferCache: true });
  }, [fetchRecommended]);

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const applyFilters = (filtersForm = form) => {
    setAppliedForm(filtersForm);
    const cacheKey = filtersCacheKey(formToFilters(filtersForm, 1));
    const cached = readRecommendedCache(cacheKey);
    if (cached && isCacheFresh(cached)) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }
    void fetchRecommended(filtersForm, {
      forceRefresh: true,
      preferCache: false,
      background: jobs.length > 0,
    });
  };

  const handleRefresh = () => {
    void fetchRecommended(appliedForm, {
      forceRefresh: true,
      preferCache: false,
      background: jobs.length > 0,
    });
  };

  const showInitialSkeleton = loading && !hasLoadedOnce && !jobs.length && !pipelineCards.length;

  const mergedListings = useMemo(
    () => mergeRoleListings(jobs, pipelineCards),
    [jobs, pipelineCards],
  );

  const filteredListings = useMemo(
    () => filterRoleListings(mergedListings, formToFilters(appliedForm, 1), stageFilter),
    [mergedListings, appliedForm, stageFilter],
  );

  const emptyMessage = error
    ? "Fix the issue above, then refresh."
    : hasActiveSearch
      ? "No roles matched your search — try different keywords or track more companies."
      : stageFilter !== "all"
        ? `No roles in ${STAGE_LABELS[stageFilter]} match these filters.`
        : "No roles match these filters — try broadening filters, add jobs from URLs, or refresh on Companies.";

  return (
    <div>
      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoreExplainerLabel variant="vector-match">
              <ScoutLabel>Recommended roles</ScoutLabel>
            </ScoreExplainerLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              Roles matched to your resume at tracked companies, plus jobs already in your pipeline. Search and filters refine Hirebase resume vector search.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ScoutSecondaryBtn onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide filters" : "Filters"}
            </ScoutSecondaryBtn>
            <ScoutSecondaryBtn onClick={handleRefresh} disabled={loading || revalidating}>
              {loading || revalidating ? "Loading…" : "Refresh"}
            </ScoutSecondaryBtn>
            <ScoutPrimaryBtn onClick={() => applyFilters()} disabled={loading || revalidating}>
              {loading || revalidating ? "Loading…" : hasActiveSearch ? "Search" : "Apply filters"}
            </ScoutPrimaryBtn>
          </div>
        </div>

        <FilterField label="Search">
          <input
            style={inputStyle}
            value={form.semanticQuery}
            onChange={(e) => setForm((f) => ({ ...f, semanticQuery: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
              }
            }}
            placeholder="e.g. remote corporate strategy, B2B SaaS, healthcare"
            maxLength={400}
          />
        </FilterField>

        {showFilters && (
          <JobFiltersGrid form={form} setForm={setForm} toggleSet={toggleSet} trackedCompanyNames={trackedCompanyNames} />
        )}

        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{error}</p>
        )}
        {hasActiveSearch && !error && searchScoped && hasLoadedOnce && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Resume matches are scoped to your tracked companies{hasActiveSearch ? " — search text adds optional focus to the vector query" : ""}.
          </p>
        )}
        {revalidating && jobs.length > 0 && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Updating recommendations…
          </p>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: border.line }}>
          <span style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, alignSelf: "center", marginRight: 4 }}>
            Stage
          </span>
          {(
            [
              ["all", "All roles"],
              ["saved", STAGE_LABELS.saved],
              ["applied", STAGE_LABELS.applied],
              ["interview", STAGE_LABELS.interview],
              ["offer", STAGE_LABELS.offer],
              ["closed", STAGE_LABELS.closed],
            ] as [StageFilter, string][]
          ).map(([id, label]) => {
            const active = stageFilter === id;
            const count =
              id === "all"
                ? mergedListings.length
                : pipelineCards.filter((c) => c.stage === id).length;
            return (
              <ChipToggle
                key={id}
                label={count > 0 ? `${label} (${count})` : label}
                active={active}
                onClick={() => onStageFilterChange(id)}
              />
            );
          })}
        </div>
      </ScoutBox>

      {showInitialSkeleton && (
        <RecommendedLoadingSkeleton message="Finding matching roles at your companies — give it a second…" />
      )}

      {!showInitialSkeleton && (
        <UnifiedRoleResultsList
          listings={filteredListings}
          savingKey={savingKey}
          onOpenRecommended={onOpenJob}
          onOpenPipeline={onOpenPipeline}
          onSaveJob={onSaveJob}
          onChangeStage={onChangeStage}
          setSavingKey={setSavingKey}
          emptyMessage={emptyMessage}
        />
      )}
    </div>
  );
}
