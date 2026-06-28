"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import {
  DEFAULT_VECTOR_SEARCH_FILTERS,
  VECTOR_SEARCH_RESULTS_MAX,
  type VectorMatchedJob,
  type VectorSearchFilters,
} from "@/lib/vector-matched-job";
import { cachedJobToMeta, companyLogoFromJobData, jobListingDedupeKey, normalizeJobUrl } from "@/lib/cached-job";
import {
  roleListingToVectorMatchedJob,
  vectorJobToRoleListing,
  type RoleListing,
} from "@/lib/role-listings";
import { isDefaultRecommendedFilters } from "@/lib/profile-preference-filters";
import type { RecommendationPreferencesState } from "@/lib/recommendation-preferences";
import {
  mergeRecommendationPriorities,
  RECOMMENDATION_RELOCATION_PRIORITIES,
} from "@/lib/recommendation-preferences";
import { parseProfileLocationString } from "@/lib/profile-location";
import {
  describeActiveFilters,
  formatProfileLocation,
  locationFieldsFromProfileString,
} from "@/lib/recommended-filter-utils";
import { postedWithinDaysFormValue } from "@/lib/job-posted-filter";
import type { KanbanCard } from "./workspace-data";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSubscription } from "@/hooks/useSubscription";
import {
  filtersCacheKey,
  readRecommendedCache,
  writeRecommendedCache,
  clearRecommendedCacheForKey,
  clearRecommendedCache,
  type RecommendedCacheEntry,
} from "@/lib/recommended-jobs-cache";
import {
  readPipelineNetworkMatchCache,
  writePipelineNetworkMatchCache,
  clearPipelineNetworkMatchCache,
} from "@/lib/pipeline-network-match-cache";
import { compareRecommendedMatchScore } from "@/lib/recommended-jobs-ranking";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { networkAgencyDisplayName } from "@/lib/network-job-display";
import type { NetworkMatchedJob } from "@/lib/network-job-match";
import { NETWORK_JOB_CLIENT_BADGE } from "@/lib/network-source-labels";
import {
  loadScopedSemanticQuery,
  saveScopedSemanticQuery,
} from "@/lib/client-session";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutInsetBox, ScoutLabel, scoutInsetChipStyle } from "./scout-box";
import { ScoreExplainerLabel } from "./score-explainer-popover";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { matchScoreStyle, isLowQualityMatchReason } from "@/lib/match-score";
import { daysSincePosted } from "@/lib/job-posted-freshness";
import { JobFreshnessLegend } from "./job-freshness-indicator";
import {
  RecommendedFiltersDrawer,
  RecommendedQuickFiltersBar,
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";
import { ProfileSuggestionsBanner } from "./pipeline-filters-ui";

type JobsApiResponse = {
  jobs?: VectorMatchedJob[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  matchMode?: string;
  needsResume?: boolean;
  needsCompanies?: boolean;
  needsProfile?: boolean;
  notice?: string;
  hint?: string;
  error?: string;
  fromSnapshot?: boolean;
  needsRefresh?: boolean;
  generatedAt?: string;
  snapshotDate?: string;
  scoreFloor?: number;
  retryAfterMs?: number;
  filtersApplied?: VectorSearchFilters;
  effectiveFilters?: VectorSearchFilters;
};

type UnifiedListing = RoleListing & {
  _networkJob?: NetworkMatchedJob;
};

function networkJobToUnifiedListing(job: NetworkMatchedJob): UnifiedListing {
  const company = networkAgencyDisplayName(job);
  return {
    dedupeKey: `network:${job.id ?? job.externalId}`,
    source: "merged",
    title: job.positionTitle,
    companyName: company,
    url: job.topEchelonUrl ?? null,
    location: job.location ?? null,
    cached: {
      title: job.positionTitle,
      companyName: company,
      url: job.topEchelonUrl ?? null,
      location: job.location ?? null,
    } as unknown as RoleListing["cached"],
    matchScore: job.matchScore,
    matchLabel: job.matchLabel,
    matchReasons: job.matchReasons,
    matchedSkills: job.matchedSkills,
    gapSkills: job.gapSkills,
    _networkJob: job,
  };
}

function ActiveFiltersBar({
  labels,
  onClear,
}: {
  labels: string[];
  onClear?: () => void;
}) {
  if (!labels.length) return null;
  return (
    <ScoutInsetBox style={{ marginTop: 12 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px", letterSpacing: "0.04em" }}>
        Active search filters
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: onClear ? 8 : 0 }}>
        {labels.map((label) => (
          <span
            key={label}
            style={{
              ...scoutInsetChipStyle,
              padding: "3px 8px",
              fontSize: T.label,
              color: color.ink,
              background: surface.card,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            fontFamily: fontSans,
            fontSize: T.label,
            color: color.muted,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Clear search filters
        </button>
      )}
    </ScoutInsetBox>
  );
}

function splitInputList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
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
    locationRadiusMiles:
      f.locationRadiusMiles != null && f.locationRadiusMiles > 0 ? String(f.locationRadiusMiles) : "",
    datePostedWithinDays: postedWithinDaysFormValue(f),
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
    relocationPriorities: [] as string[],
  };
}

type FilterForm = RecommendedFilterForm;

function relocationOnly(priorities: string[]): string[] {
  return priorities.filter((p) =>
    (RECOMMENDATION_RELOCATION_PRIORITIES as readonly string[]).includes(p),
  );
}

function mergeProfilePrioritiesIntoForm(form: FilterForm, priorities: string[]): FilterForm {
  const locationTypes = new Set(form.locationTypes);
  if (priorities.includes("Remote-first")) locationTypes.add("Remote");
  if (priorities.includes("Hybrid-friendly")) locationTypes.add("Hybrid");
  return {
    ...form,
    locationTypes,
    relocationPriorities: relocationOnly(priorities),
  };
}

function profilePrioritiesFromForm(form: FilterForm): string[] {
  const set = new Set(relocationOnly(form.relocationPriorities));
  if (form.locationTypes.has("Remote")) set.add("Remote-first");
  if (form.locationTypes.has("Hybrid")) set.add("Hybrid-friendly");
  return [...set];
}

function profileLocationFromForm(form: FilterForm): string {
  const parsed = parseProfileLocationString(
    formatProfileLocation({
      city: form.locationCity.trim() || undefined,
      region: form.locationRegion.trim() || undefined,
      country: form.locationCountry.trim() || undefined,
    }),
  );
  return parsed ? formatProfileLocation(parsed) : "";
}

function defaultFeedForm(): FilterForm {
  return {
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: "",
  };
}

function defaultFeedCacheKey(): string {
  return filtersCacheKey(formToFilters(defaultFeedForm(), 1));
}

function readDefaultFeedCache(): RecommendedCacheEntry | null {
  return readRecommendedCache(defaultFeedCacheKey());
}

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
    locationTypes: form.locationTypes.size ? [...form.locationTypes] : undefined,
    jobTypes: form.jobTypes.size ? [...form.jobTypes] : undefined,
    experienceLevels: form.experienceLevels.size ? [...form.experienceLevels] : undefined,
    companySizeBuckets: form.companySizeBuckets.size ? [...form.companySizeBuckets] : undefined,
    visaSponsored: form.visaSponsored || undefined,
    datePostedWithinDays: form.datePostedWithinDays.trim()
      ? Number(form.datePostedWithinDays)
      : undefined,
    datePostedFrom: undefined,
    locationRadiusMiles: form.locationRadiusMiles.trim()
      ? Number(form.locationRadiusMiles)
      : undefined,
    salaryFrom: form.salaryFrom.trim() ? Number(form.salaryFrom) : undefined,
    salaryTo: form.salaryTo.trim() ? Number(form.salaryTo) : undefined,
    yearsFrom: form.yearsFrom.trim() ? Number(form.yearsFrom) : undefined,
    yearsTo: form.yearsTo.trim() ? Number(form.yearsTo) : undefined,
    locations: locationParts.length
      ? [{ city: form.locationCity.trim() || undefined, region: form.locationRegion.trim() || undefined, country: form.locationCountry.trim() || undefined }]
      : undefined,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.caption,
  boxSizing: "border-box",
  background: surface.card,
};

function RecommendedResultsLoader() {
  return (
    <ScoutBox padding={28} style={{ marginBottom: 12 }}>
      <KimchiProcessLoader preset="recommendations" variant="inline" fullWidth />
    </ScoutBox>
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
    days: daysSincePosted(job.datePosted) ?? 0,
    _url: job.url ?? undefined,
    _meta: meta,
  };
}

function recommendedDedupeKey(job: VectorMatchedJob): string {
  return jobListingDedupeKey({
    companyName: job.companyName,
    title: job.title,
    url: job.url,
  });
}

function CircularMatchScore({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 80, height: 80 }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: "block" }}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#44E8A4"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>
          {score}<span style={{ fontSize: 11 }}>%</span>
        </span>
      </div>
    </div>
  );
}

function WhyMatchPanel({ reasons, matchedSkills }: { reasons: string[]; matchedSkills: string[] }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7.5 1L9 6H14.5L10 9.5L11.5 14.5L7.5 11.5L3.5 14.5L5 9.5L0.5 6H6L7.5 1Z" fill="#44E8A4" stroke="#44E8A4" strokeWidth="0.5" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
          Why This Job Is A Match
        </span>
      </div>
      {reasons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: matchedSkills.length > 0 ? 14 : 0 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ color: "#44E8A4", fontSize: 13, lineHeight: "1.45", flexShrink: 0, fontWeight: 700 }}>✓</span>
              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.45 }}>{r}</span>
            </div>
          ))}
        </div>
      )}
      {matchedSkills.length > 0 && (
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 7px" }}>
            Matched Skills
          </p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {matchedSkills.map((skill) => (
              <span key={skill} style={{ display: "inline-block", padding: "3px 10px", fontSize: T.label, fontWeight: 600, color: "#44E8A4", background: "rgba(68,232,164,0.12)", border: "1px solid rgba(68,232,164,0.35)", borderRadius: 4 }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBriefcase() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="4" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.5 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="1" y1="7.5" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="7" width="2.5" height="5" rx="0.5" fill="currentColor"/>
      <rect x="5" y="4" width="2.5" height="8" rx="0.5" fill="currentColor"/>
      <rect x="9" y="1" width="2.5" height="11" rx="0.5" fill="currentColor"/>
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 6L6.5 1.5L11.5 6V12H8.5V9H4.5V12H1.5V6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="1" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6.5 3V10M4.5 8.5C4.5 8.5 5 9.5 6.5 9.5C8 9.5 8.5 8.5 8.5 7.5C8.5 6 6.5 6 6.5 6C6.5 6 4.5 6 4.5 4.5C4.5 3.5 5 3 6.5 3C8 3 8.5 4 8.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function MetadataGrid({
  row,
  isNetwork: _isNetwork,
  networkJob: _networkJob,
}: {
  row: UnifiedListing;
  isNetwork: boolean;
  networkJob?: NetworkMatchedJob;
}) {
  const c = row.cached;
  const items: { icon: JSX.Element; label: string }[] = [];
  if (c.locationType) items.push({ icon: <IconHome />, label: c.locationType });
  else if (c.remote) items.push({ icon: <IconHome />, label: "Remote" });
  if (c.jobType) items.push({ icon: <IconBriefcase />, label: c.jobType });
  if (c.seniority) items.push({ icon: <IconBarChart />, label: c.seniority });
  if (c.salary) items.push({ icon: <IconDollar />, label: c.salary });
  if (c.experienceLevel) items.push({ icon: <IconCalendar />, label: c.experienceLevel });
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 18px", marginTop: 10 }}>
      {items.map(({ icon, label }, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, color: color.muted }}>
          <span style={{ display: "flex", flexShrink: 0, opacity: 0.65 }}>{icon}</span>
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, whiteSpace: "nowrap" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendedJobCard({
  row,
  savingKey,
  networkSavingId,
  onOpenRecommended,
  onSaveJob,
  onOpenNetworkJob,
  onSaveNetworkJob,
  setSavingKey,
  setNetworkSavingId,
}: {
  row: UnifiedListing;
  savingKey: string | null;
  networkSavingId: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  onOpenNetworkJob?: (job: NetworkJobListing) => void;
  onSaveNetworkJob?: (job: NetworkJobListing) => Promise<void>;
  setSavingKey: (key: string | null) => void;
  setNetworkSavingId: (id: string | null) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const isNetwork = Boolean(row._networkJob);
  const networkJob = row._networkJob;

  const handleOpen = () => {
    if (isNetwork && networkJob && onOpenNetworkJob) {
      onOpenNetworkJob(networkJob);
    } else {
      onOpenRecommended(roleListingToVectorMatchedJob(row));
    }
  };

  const handleSave = () => {
    if (isNetwork && networkJob && onSaveNetworkJob) {
      const nid = networkJob.id ?? networkJob.externalId ?? row.dedupeKey;
      setNetworkSavingId(nid);
      onSaveNetworkJob(networkJob).finally(() => setNetworkSavingId(null));
    } else {
      const matchJob = roleListingToVectorMatchedJob(row);
      setSavingKey(row.dedupeKey);
      onSaveJob(matchJob).finally(() => setSavingKey(null));
    }
  };

  const isSaving = isNetwork
    ? networkSavingId === (networkJob?.id ?? networkJob?.externalId ?? row.dedupeKey)
    : savingKey === row.dedupeKey;

  const matchScore = row.matchScore ?? 0;
  const matchLabel = row.matchLabel ?? "";
  const reasons = (row.matchReasons ?? []).filter((r) => !isLowQualityMatchReason(r)).slice(0, 4);
  const matchedSkills = (row.matchedSkills ?? []).slice(0, 6);
  const hasWhyContent = reasons.length > 0 || matchedSkills.length > 0;

  const score = matchScoreStyle(matchScore);
  const panelBg = matchScore >= 75 ? "#0D2419" : matchScore >= 60 ? "#1F1508" : "#1A1A1A";

  const postedDays = !isNetwork && row.cached?.datePosted ? daysSincePosted(row.cached.datePosted) : null;
  const postedText =
    postedDays === null
      ? null
      : postedDays === 0
        ? "Posted today"
        : postedDays === 1
          ? "Posted 1 day ago"
          : `Posted ${postedDays} days ago`;
  const isRecentPost = postedDays !== null && postedDays <= 3;

  return (
    <div
      key={row.dedupeKey}
      style={{
        display: "flex",
        border: "1.5px solid #161616",
        background: surface.card,
        overflow: "hidden",
      }}
    >
      {/* Left: job content area — swaps to "Why Match" when hovering score panel */}
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
          style={{ flex: 1, padding: 18, cursor: "pointer" }}
        >
          {showWhy && hasWhyContent ? (
            <WhyMatchPanel reasons={reasons} matchedSkills={matchedSkills} />
          ) : (
            <>
              {/* Top badge row */}
              {(isNetwork || postedText || row.isTrackedCompany) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {isNetwork && networkJob?.sharedAt ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        fontSize: T.label,
                        fontWeight: 500,
                        color: color.muted,
                        background: "rgba(0,0,0,0.04)",
                        border: "1px solid rgba(0,0,0,0.07)",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Shared {networkJob.sharedAtRelative || networkJob.sharedAtLabel}
                    </span>
                  ) : postedText ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        fontSize: T.label,
                        fontWeight: 500,
                        color: isRecentPost ? color.forest : color.muted,
                        background: isRecentPost ? "rgba(26,58,47,0.07)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${isRecentPost ? "rgba(26,58,47,0.15)" : "rgba(0,0,0,0.07)"}`,
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {postedText}
                    </span>
                  ) : null}
                  {isNetwork && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        fontSize: T.label,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#7A4F00",
                        background: "rgba(196,140,40,0.14)",
                        border: "1px solid rgba(196,140,40,0.35)",
                        borderRadius: 4,
                      }}
                    >
                      {NETWORK_JOB_CLIENT_BADGE}
                    </span>
                  )}
                  {row.isTrackedCompany && (
                    <span
                      style={{
                        ...scoutInsetChipStyle,
                        display: "inline-block",
                        padding: "3px 9px",
                        fontSize: T.label,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: color.forest,
                        background: "rgba(26,58,47,0.08)",
                        border: border.lineStrong,
                        borderRadius: 4,
                      }}
                    >
                      Watchlist
                    </span>
                  )}
                </div>
              )}
              {/* Logo + Title + Company */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <CompanyLogo {...(isNetwork ? { name: row.companyName, size: 44 } : { ...companyLogoFromJobData(row.companyName, row.cached), size: 44 })} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{row.title}</p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                    {row.companyName}
                    {row.location ? ` · ${row.location}` : ""}
                  </p>
                  <MetadataGrid row={row} isNetwork={isNetwork} networkJob={networkJob} />
                </div>
              </div>
            </>
          )}
        </div>
        <div
          style={{ display: "flex", gap: 8, padding: "0 18px 16px", flexWrap: "wrap", alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "8px 16px",
              background: isSaving ? "#888" : "#AE7AFF",
              color: "#FFFFFF",
              border: "1.5px solid #161616",
              borderRadius: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.65 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save job"}
          </button>
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
      </div>
      {/* Right: dark score panel — hover triggers "Why Match" in left content */}
      {matchScore > 0 && (
        <div
          onMouseEnter={() => setShowWhy(true)}
          onMouseLeave={() => setShowWhy(false)}
          style={{
            width: 120,
            flexShrink: 0,
            background: panelBg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "20px 12px",
            cursor: "default",
            borderLeft: "1.5px solid rgba(255,255,255,0.07)",
          }}
        >
          <CircularMatchScore score={matchScore} />
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 10,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              textAlign: "center",
              margin: 0,
            }}
          >
            {matchLabel} Match
          </p>
        </div>
      )}
    </div>
  );
}

function RecommendedResultsList({
  listings,
  savingKey,
  onOpenRecommended,
  onSaveJob,
  onOpenNetworkJob,
  onSaveNetworkJob,
  networkSavingId,
  setNetworkSavingId,
  setSavingKey,
  emptyMessage,
}: {
  listings: UnifiedListing[];
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  onOpenNetworkJob?: (job: NetworkJobListing) => void;
  onSaveNetworkJob?: (job: NetworkJobListing) => Promise<void>;
  networkSavingId: string | null;
  setNetworkSavingId: (id: string | null) => void;
  setSavingKey: (key: string | null) => void;
  emptyMessage: string;
}) {
  if (!listings.length) {
    return (
      <ScoutBox style={{ padding: 40, textAlign: "center", border: "1.5px solid #161616" }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>{emptyMessage}</p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {listings.map((row) => (
        <RecommendedJobCard
          key={row.dedupeKey}
          row={row}
          savingKey={savingKey}
          networkSavingId={networkSavingId}
          onOpenRecommended={onOpenRecommended}
          onSaveJob={onSaveJob}
          onOpenNetworkJob={onOpenNetworkJob}
          onSaveNetworkJob={onSaveNetworkJob}
          setSavingKey={setSavingKey}
          setNetworkSavingId={setNetworkSavingId}
        />
      ))}
    </div>
  );
}

export function PipelineRecommendedSection({
  pipelineCards,
  onOpenJob,
  onSaveJob,
  onOpenNetworkJob,
  onSaveNetworkJob,
  actingUserId,
}: {
  /** Used only to hide roles already saved to the pipeline. */
  pipelineCards: KanbanCard[];
  onOpenJob: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  onOpenNetworkJob?: (job: NetworkJobListing) => void;
  onSaveNetworkJob?: (job: NetworkJobListing) => Promise<void>;
  actingUserId?: string | null;
}) {
  const isMobile = useIsMobile();
  const { withClientScope, isAdminReviewing, openPricing } = useWorkspace();
  const { isPro, isAdmin } = useSubscription();
  const hasProAccess = isPro || isAdmin;
  const [form, setForm] = useState(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: loadScopedSemanticQuery(),
  }));
  const [appliedForm, setAppliedForm] = useState<FilterForm>(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: "",
  }));
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<RecommendationPreferencesState | null>(null);

  const [jobs, setJobs] = useState<VectorMatchedJob[]>(() => readDefaultFeedCache()?.jobs ?? []);
  const [loading, setLoading] = useState(() => !readDefaultFeedCache());
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(() => readDefaultFeedCache()?.error ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<{ fromSnapshot: boolean; generatedAt?: string } | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(readDefaultFeedCache()));
  const [trackedCompanyNames, setTrackedCompanyNames] = useState<string[]>([]);
  const [activeFilterLabels, setActiveFilterLabels] = useState<string[]>([]);
  const [profileSuggestedLabels, setProfileSuggestedLabels] = useState<string[]>([]);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [networkJobs, setNetworkJobs] = useState<NetworkMatchedJob[]>(() => readPipelineNetworkMatchCache()?.jobs ?? []);
  const [networkSavingId, setNetworkSavingId] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const prevActingUserIdRef = useRef<string | null | undefined>(undefined);
  const fetchGenRef = useRef(0);
  const defaultFormRef = useRef<FilterForm | null>(null);

  const hasActiveSearch = Boolean(appliedForm.semanticQuery.trim());
  const appliedFilters = useMemo(() => formToFilters(appliedForm, 1), [appliedForm]);
  const isDefaultAppliedFeed = useMemo(
    () => isDefaultRecommendedFilters(appliedFilters) && !appliedForm.semanticQuery.trim(),
    [appliedFilters, appliedForm.semanticQuery],
  );
  const hasSearchFilters = !isDefaultAppliedFeed;

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
        setNotice(null);
      } else {
        setRevalidating(true);
      }

      const semanticQuery = filtersForm.semanticQuery.trim();
      saveScopedSemanticQuery(semanticQuery);

      try {
        const res = await fetch(withClientScope("/api/jobs/recommended"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: forceRefresh ? "no-store" : "default",
          body: JSON.stringify({
            ...filters,
            preferCache: options?.preferCache ?? !forceRefresh,
            forceRefresh,
          }),
        });
        const data = (await res.json()) as JobsApiResponse;
        if (gen !== fetchGenRef.current) return;

        if (!res.ok) {
          const rawMsg = formatApiErrorMessage(data.error, "Couldn't load recommended roles.");
          const isEmbedNoise =
            !forceRefresh && /embed|artifact|hirebase|permission|forbidden|403|vector/i.test(rawMsg);
          const msg = isEmbedNoise ? null : data.hint ? `${rawMsg} ${data.hint}` : rawMsg;
          setError(msg);
          setNotice(null);
          const applied = data.effectiveFilters ?? data.filtersApplied;
          if (applied) {
            setActiveFilterLabels(describeActiveFilters(applied));
          }
          if (msg) setFiltersDrawerOpen(true);
          if (!background) setJobs([]);
          writeRecommendedCache({
            jobs: [],
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            error: msg,
          });
        } else {
          const nextJobs = data.jobs ?? [];
          const snapshotPending =
            nextJobs.length === 0 &&
            data.needsRefresh === true &&
            !forceRefresh &&
            (options?.preferCache ?? true);

          if (snapshotPending) {
            void fetchRecommended(filtersForm, {
              preferCache: false,
              background: background || hasLoadedOnce,
            });
            return;
          }

          setJobs(nextJobs);
          setError(null);
          setNotice(data.notice?.trim() || null);
          const applied = data.effectiveFilters ?? data.filtersApplied ?? filters;
          setActiveFilterLabels(describeActiveFilters(applied));
          setSnapshotMeta({
            fromSnapshot: data.fromSnapshot === true,
            generatedAt: data.generatedAt ?? new Date().toISOString(),
          });
          writeRecommendedCache({
            jobs: nextJobs,
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            matchMode: data.matchMode,
            error: null,
          });
        }
        setHasLoadedOnce(true);
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setError(formatApiErrorMessage(err, "Couldn't load recommended roles — hit Refresh."));
        if (!background) setJobs([]);
        setHasLoadedOnce(true);
      } finally {
        if (gen === fetchGenRef.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    [withClientScope],
  );

  useEffect(() => {
    void fetch(withClientScope("/api/jobs/recommended/defaults"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { filters?: VectorSearchFilters; labels?: string[] } | null) => {
        if (data?.filters) {
          defaultFormRef.current = filtersToForm({ ...DEFAULT_VECTOR_SEARCH_FILTERS, ...data.filters });
          setProfileSuggestedLabels(data.labels ?? describeActiveFilters(data.filters));
        }
        setDefaultsLoaded(true);
      })
      .catch(() => setDefaultsLoaded(true));

    void fetch(withClientScope("/api/profile"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { parsedData?: { location?: string | null }; priorities?: string[] } | null) => {
        if (!data) return;
        const fields = locationFieldsFromProfileString(data.parsedData?.location);
        const priorities = Array.isArray(data.priorities) ? data.priorities : [];
        setProfileBaseline({
          location: fields.display,
          priorities: [...priorities],
        });
      })
      .catch(() => {});
  }, [actingUserId, withClientScope]);

  useEffect(() => {
    fetch(withClientScope("/api/companies"))
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ name?: string }>) => {
        const names = [...new Set((Array.isArray(data) ? data : []).map((c) => c.name?.trim()).filter(Boolean) as string[])].sort();
        setTrackedCompanyNames(names);
      })
      .catch(() => {
        /* optional suggestions */
      });
  }, [actingUserId, withClientScope]);

  useEffect(() => {
    if (!onOpenNetworkJob) return;

    const cached = readPipelineNetworkMatchCache();
    if (cached) {
      setNetworkJobs(cached.jobs);
      return;
    }

    fetch(withClientScope("/api/network-jobs/match?limit=50"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { jobs?: NetworkMatchedJob[] } | null) => {
        if (data?.jobs) {
          setNetworkJobs(data.jobs);
          writePipelineNetworkMatchCache({ jobs: data.jobs, fetchedAt: Date.now() });
        }
      })
      .catch(() => {});
  }, [actingUserId, withClientScope, onOpenNetworkJob]);

  useEffect(() => {
    const prev = prevActingUserIdRef.current;
    prevActingUserIdRef.current = actingUserId ?? null;
    if (prev === undefined) return;

    mountedRef.current = false;
    setDefaultsLoaded(false);
    defaultFormRef.current = null;
    clearRecommendedCache();
    clearPipelineNetworkMatchCache();
    setJobs([]);
    setNetworkJobs([]);
    setHasLoadedOnce(false);
    setLoading(true);
    setError(null);
    setNotice(null);
    setActiveFilterLabels([]);
    setProfileSuggestedLabels([]);
    const empty = filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS);
    setForm({ ...empty, semanticQuery: loadScopedSemanticQuery() });
    setAppliedForm({ ...empty, semanticQuery: "" });
  }, [actingUserId]);

  useEffect(() => {
    if (mountedRef.current || !defaultsLoaded) return;
    mountedRef.current = true;

    const feedForm = defaultFeedForm();

    if (isAdminReviewing) {
      void fetchRecommended(feedForm, { preferCache: false, forceRefresh: true });
      return;
    }

    const cached = readRecommendedCache(defaultFeedCacheKey());
    if (cached) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void fetchRecommended(feedForm, { preferCache: false });
  }, [fetchRecommended, actingUserId, defaultsLoaded, isAdminReviewing]);

  const saveProfileFromForm = useCallback(async (filtersForm: FilterForm) => {
    const location = profileLocationFromForm(filtersForm);
    const priorities = profilePrioritiesFromForm(filtersForm);
    const unchanged =
      profileBaseline &&
      location.trim() === (profileBaseline.location ?? "").trim() &&
      JSON.stringify([...priorities].sort()) === JSON.stringify([...profileBaseline.priorities].sort());
    if (unchanged) return;

    const profileRes = await fetch(withClientScope("/api/profile"));
    const profile = (await profileRes.json().catch(() => ({}))) as {
      parsedData?: Record<string, unknown> | null;
    };
    if (!profileRes.ok) return;

    const parsedData = {
      ...(profile.parsedData && typeof profile.parsedData === "object" ? profile.parsedData : {}),
      location: location.trim() || null,
    };
    await fetch(withClientScope("/api/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsedData, priorities }),
    });
    setProfileBaseline({ location: location.trim(), priorities: [...priorities] });
  }, [profileBaseline, withClientScope]);

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const applyProfileSuggestions = () => {
    const suggested = defaultFormRef.current;
    if (!suggested) return;
    setForm({
      ...suggested,
      semanticQuery: form.semanticQuery,
    });
    setFiltersDrawerOpen(true);
  };

  const applyFilters = async (filtersForm = form) => {
    await saveProfileFromForm(filtersForm);
    setAppliedForm(filtersForm);
    setActiveFilterLabels(describeActiveFilters(formToFilters(filtersForm, 1)));
    const cacheKey = filtersCacheKey(formToFilters(filtersForm, 1));
    const isDefaultFeed =
      cacheKey === defaultFeedCacheKey() && !filtersForm.semanticQuery.trim();

    if (isDefaultFeed) {
      void fetchRecommended(filtersForm, { preferCache: false, forceRefresh: isAdminReviewing });
      return;
    }

    void fetchRecommended(filtersForm, {
      preferCache: false,
      background: jobs.length > 0,
    });
  };

  const handleRefresh = () => {
    if (!hasProAccess) {
      openPricing();
      return;
    }
    clearRecommendedCacheForKey(filtersCacheKey(formToFilters(appliedForm, 1)));
    clearPipelineNetworkMatchCache();
    void fetchRecommended(appliedForm, {
      forceRefresh: true,
      preferCache: false,
      background: false,
    });
    if (onOpenNetworkJob) {
      fetch(withClientScope("/api/network-jobs/match?limit=50"))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { jobs?: NetworkMatchedJob[] } | null) => {
          if (data?.jobs) {
            setNetworkJobs(data.jobs);
            writePipelineNetworkMatchCache({ jobs: data.jobs, fetchedAt: Date.now() });
          }
        })
        .catch(() => {});
    }
  };

  const savedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const card of pipelineCards) {
      const ext = card as KanbanCard & { _url?: string };
      const key = normalizeJobUrl(ext._url) ?? `${card.company.trim()}:${card.role.trim()}`.toLowerCase();
      keys.add(key);
    }
    return keys;
  }, [pipelineCards]);

  const clearSearchFilters = () => {
    const reset = defaultFeedForm();
    setForm({ ...reset, semanticQuery: "" });
    setAppliedForm(reset);
    saveScopedSemanticQuery("");
    setFiltersDrawerOpen(false);
    setActiveFilterLabels([]);
    const cached = readRecommendedCache(defaultFeedCacheKey());
    if (cached) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }
    void fetchRecommended(reset, { preferCache: false });
  };

  const recommendedListings = useMemo(() => {
    const byKey = new Map<string, UnifiedListing>();
    for (const job of jobs) {
      if (savedKeys.has(recommendedDedupeKey(job))) continue;
      const listing: UnifiedListing = vectorJobToRoleListing(job);
      const existing = byKey.get(listing.dedupeKey);
      if (!existing) {
        byKey.set(listing.dedupeKey, listing);
        continue;
      }
      const scoreA = listing.matchScore ?? 0;
      const scoreB = existing.matchScore ?? 0;
      if (scoreA > scoreB) byKey.set(listing.dedupeKey, listing);
    }
    for (const nj of networkJobs) {
      const listing = networkJobToUnifiedListing(nj);
      if (byKey.has(listing.dedupeKey)) continue;
      byKey.set(listing.dedupeKey, listing);
    }
    return [...byKey.values()];
  }, [jobs, networkJobs, savedKeys]);

  const filteredListings = useMemo(
    () =>
      [...recommendedListings].sort((a, b) => {
        const scoreA = a.matchScore ?? 0;
        const scoreB = b.matchScore ?? 0;
        return scoreB - scoreA;
      }),
    [recommendedListings],
  );

  const emptyMessage = error
    ? "Fix the issue above, then hit Refresh."
    : notice
      ? "Review the note above — these are broader matches while we refine your personalized feed."
      : hasActiveSearch
        ? "Nothing matched — try different keywords or loosen your filters."
        : recommendedListings.length === 0 && jobs.length > 0
          ? "You've saved everything in today's list — check back after the daily refresh."
          : "No matches right now — add target roles or upload a resume under Profile, then refresh.";

  const showInitialLoader = (loading || revalidating) && !hasLoadedOnce;
  const showRefreshLoader = (loading || revalidating) && hasLoadedOnce && jobs.length > 0;

  return (
    <div>
      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "flex-start",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <ScoreExplainerLabel variant="vector-match">
              <ScoutLabel>Roles</ScoutLabel>
            </ScoreExplainerLabel>
            {hasLoadedOnce && !showInitialLoader && (
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "6px 0 0" }}>
                {snapshotMeta?.fromSnapshot ? "Daily snapshot" : "Live results"}
                {snapshotMeta?.generatedAt
                  ? ` · updated ${new Date(snapshotMeta.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                  : ""}
                {" · "}
                {filteredListings.length} role{filteredListings.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || revalidating}
            style={{
              alignSelf: isMobile ? "flex-start" : "flex-end",
              padding: "8px 16px",
              background: "transparent",
              color: "#161616",
              border: "1.5px solid #161616",
              borderRadius: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: loading || revalidating ? "not-allowed" : "pointer",
              opacity: loading || revalidating ? 0.65 : 1,
            }}
          >
            {loading || revalidating ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexDirection: isMobile ? "column" : "row" }}>
          <input
            style={{ ...inputStyle, flex: 1, margin: 0 }}
            value={form.semanticQuery}
            onChange={(e) => setForm((f) => ({ ...f, semanticQuery: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
              }
            }}
            placeholder="Title, skill, or company"
            aria-label="Search roles"
            maxLength={400}
          />
          <button
            type="button"
            onClick={() => applyFilters()}
            disabled={loading || revalidating}
            style={{
              flexShrink: 0,
              minWidth: isMobile ? undefined : 96,
              padding: "8px 16px",
              background: "#AE7AFF",
              color: "#FFFFFF",
              border: "1.5px solid #161616",
              borderRadius: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: loading || revalidating ? "not-allowed" : "pointer",
              opacity: loading || revalidating ? 0.65 : 1,
            }}
          >
            {loading || revalidating ? "Loading…" : "Search"}
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: border.line,
          }}
        >
          <RecommendedQuickFiltersBar
            form={form}
            setForm={setForm}
            toggleSet={toggleSet}
            trackedCompanyNames={trackedCompanyNames}
            onQuickApply={(nextForm) => void applyFilters(nextForm)}
            onOpenAllFilters={() => setFiltersDrawerOpen(true)}
            activeFilterCount={activeFilterLabels.length}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <JobFreshnessLegend compact />
        </div>

        {profileSuggestedLabels.length > 0 && isDefaultAppliedFeed && (
          <ProfileSuggestionsBanner
            labels={profileSuggestedLabels}
            onApply={applyProfileSuggestions}
            hint="Not applied automatically — click Apply & search to copy these into your filters, then adjust before searching."
          />
        )}

        <RecommendedFiltersDrawer
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          form={form}
          setForm={setForm}
          toggleSet={toggleSet}
          trackedCompanyNames={trackedCompanyNames}
          applying={loading || revalidating}
          onApply={() => {
            void applyFilters().then(() => setFiltersDrawerOpen(false));
          }}
          onReset={() => {
            const reset = defaultFeedForm();
            setForm({ ...reset, semanticQuery: form.semanticQuery });
          }}
        />

        <ActiveFiltersBar labels={activeFilterLabels} onClear={hasSearchFilters ? clearSearchFilters : undefined} />

        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{error}</p>
        )}
        {notice && (
          <ScoutInsetBox style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.45 }}>
            {notice}
          </ScoutInsetBox>
        )}
        {hasActiveSearch && !error && hasLoadedOnce && !showInitialLoader && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Custom filters run a live search — results may differ from your daily snapshot.
          </p>
        )}
      </ScoutBox>

      {showInitialLoader ? (
        <RecommendedResultsLoader />
      ) : (
        <>
          {showRefreshLoader && (
            <div style={{ marginBottom: 12 }}>
              <KimchiProcessLoader
                preset="recommendations"
                variant="inline"
                fullWidth
                title="Updating your matches…"
              />
            </div>
          )}
          <RecommendedResultsList
            listings={filteredListings}
            savingKey={savingKey}
            onOpenRecommended={onOpenJob}
            onSaveJob={onSaveJob}
            onOpenNetworkJob={onOpenNetworkJob}
            onSaveNetworkJob={onSaveNetworkJob}
            networkSavingId={networkSavingId}
            setNetworkSavingId={setNetworkSavingId}
            setSavingKey={setSavingKey}
            emptyMessage={emptyMessage}
          />
        </>
      )}
    </div>
  );
}
