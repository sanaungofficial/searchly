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
  RECOMMENDED_SORT_OPTIONS,
  type RecommendedSortOption,
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
  migrateRecommendedCacheScope,
  markDefaultRecommendedFeedLoaded,
  hasDefaultRecommendedFeedLoaded,
  type RecommendedCacheEntry,
} from "@/lib/recommended-jobs-cache";
import { compareRoleSearchRelevance } from "@/lib/job-match";
import { filterRoleListings } from "@/lib/role-listings";
import {
  loadScopedSemanticQuery,
  saveScopedSemanticQuery,
} from "@/lib/client-session";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutInsetBox, ScoutLabel, scoutInsetChipStyle } from "./scout-box";
import { ScoreExplainerLabel } from "./score-explainer-popover";
import { MatchScoreColumn } from "@/components/scout/match-why-score-ui";
import { fontSans, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { daysSincePosted } from "@/lib/job-posted-freshness";
import { JobFreshnessLegend } from "./job-freshness-indicator";
import {
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";
import { OpportunitiesJobrightFilterBar } from "./opportunities-jobright-filter-bar";
import { OpportunitiesAllFiltersModal } from "./opportunities-all-filters-modal";
import {
  OpportunitiesPrefConfirmModal,
  shouldShowOpportunitiesPrefConfirm,
} from "./opportunities-pref-confirm-modal";
import {
  applySearchPreferencesToFilterForm,
  emptyExtendedFilterFields,
  hirebaseCompanyTypesFromStages,
  hirebaseLevelsFromExperienceLabelSet,
  mergeSearchPreferencesIntoFilters,
  patchParsedDataSearchPreferences,
  searchPreferencesFromFilterForm,
  searchPreferencesFromParsedData,
  type SearchPreferences,
} from "@/lib/search-preferences";
import {
  loosenStackedHirebaseFilters,
} from "@/lib/opportunities-hirebase-filters";
import { isDefaultRecommendedFilters } from "@/lib/profile-preference-filters";

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

type UnifiedListing = RoleListing;

function splitInputList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function splitInputListOrUndefined(value: string): string[] | undefined {
  const items = splitInputList(value);
  return items.length ? items : undefined;
}

function filtersToForm(f: VectorSearchFilters, searchPrefs?: SearchPreferences) {
  const locationAllInCountry = searchPrefs?.locationAllInCountry === true;
  const loc = f.locations?.[0];
  const base = {
    semanticQuery: f.semanticQuery ?? "",
    jobTitles: (f.jobTitles ?? []).join(", "),
    keywords: (f.keywords ?? []).join(", "),
    companyName: f.companyName ?? "",
    industries: (f.industries ?? []).join(", "),
    subindustries: (f.subindustries ?? []).join(", "),
    jobCategories: (f.jobCategories ?? []).join(", "),
    locationCity: locationAllInCountry ? "" : (loc?.city ?? ""),
    locationRegion: locationAllInCountry ? "" : (loc?.region ?? ""),
    locationCountry: loc?.country ?? "",
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
    experienceLevelLabels: new Set(searchPrefs?.experienceLevelLabels ?? []),
    companySizeBuckets: new Set(f.companySizeBuckets ?? []),
    visaSponsored: f.visaSponsored === true,
    relocationPriorities: [] as string[],
    ...emptyExtendedFilterFields(),
    customJobFunctions: searchPrefs?.customJobFunctions ?? [],
    locationAllInCountry,
  };
  return searchPrefs ? applySearchPreferencesToFilterForm(base, searchPrefs) : base;
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
  return { ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS), semanticQuery: "" };
}

function defaultFeedCacheKey(): string {
  return filtersCacheKey(formToFilters(defaultFeedForm(), 1));
}

function readDefaultFeedCache(): RecommendedCacheEntry | null {
  return readRecommendedCache(defaultFeedCacheKey());
}

function formToFilters(form: FilterForm, page: number): VectorSearchFilters {
  const locationParts = [form.locationCity, form.locationRegion, form.locationCountry].filter(Boolean);
  const baseKeywords = splitInputListOrUndefined(form.keywords);
  const skillKeywords = splitInputListOrUndefined(form.skills);
  const customJobFunctions = (form.customJobFunctions ?? []).map((s) => s.trim()).filter(Boolean);
  const mergedKeywords =
    baseKeywords || skillKeywords
      ? [...new Set([...(baseKeywords ?? []), ...(skillKeywords ?? [])])]
      : undefined;

  const hasLocation =
    form.locationAllInCountry && form.locationCountry.trim()
      ? true
      : locationParts.length > 0;

  const raw: VectorSearchFilters = {
    ...DEFAULT_VECTOR_SEARCH_FILTERS,
    page,
    limit: VECTOR_SEARCH_RESULTS_MAX,
    semanticQuery: form.semanticQuery.trim() || undefined,
    customJobFunctions: customJobFunctions.length ? customJobFunctions : undefined,
    jobTitles: splitInputListOrUndefined(form.jobTitles),
    keywords: mergedKeywords,
    companyName: form.companyName.trim() || undefined,
    industries: splitInputListOrUndefined(form.industries),
    subindustries: undefined,
    jobCategories: splitInputListOrUndefined(form.jobCategories),
    jobBoard: form.jobBoard.trim() || undefined,
    locationTypes: form.locationTypes.size ? [...form.locationTypes] : undefined,
    jobTypes: form.jobTypes.size ? [...form.jobTypes] : undefined,
    experienceLevels: form.openToAllExperience
      ? undefined
      : form.experienceLevelLabels.size
        ? hirebaseLevelsFromExperienceLabelSet(form.experienceLevelLabels)
        : form.experienceLevels.size
          ? [...form.experienceLevels]
          : undefined,
    companySizeBuckets: undefined,
    companyTypes: form.companyStages.size
      ? hirebaseCompanyTypesFromStages([...form.companyStages])
      : undefined,
    visaSponsored: form.visaSponsored || undefined,
    datePostedWithinDays: form.datePostedWithinDays.trim()
      ? Number(form.datePostedWithinDays)
      : undefined,
    datePostedFrom: undefined,
    locationRadiusMiles: form.locationRadiusMiles.trim()
      ? Number(form.locationRadiusMiles)
      : undefined,
    salaryFrom: form.openToAllSalary || !form.salaryFrom.trim() ? undefined : Number(form.salaryFrom),
    salaryTo: form.openToAllSalary || !form.salaryTo.trim() ? undefined : Number(form.salaryTo),
    yearsFrom: form.openToAllExperience || !form.yearsFrom.trim() ? undefined : Number(form.yearsFrom),
    yearsTo: form.openToAllExperience || !form.yearsTo.trim() ? undefined : Number(form.yearsTo),
    locations: hasLocation
      ? [
          {
            city: form.locationAllInCountry ? undefined : form.locationCity.trim() || undefined,
            region: form.locationAllInCountry ? undefined : form.locationRegion.trim() || undefined,
            country: form.locationCountry.trim() || undefined,
          },
        ]
      : undefined,
  };

  const prefs = searchPreferencesFromFilterForm(form);
  return mergeSearchPreferencesIntoFilters(prefs, loosenStackedHirebaseFilters(raw));
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
}: {
  row: UnifiedListing;
}) {
  const c = row.cached;
  const items: { icon: JSX.Element; label: string }[] = [];
  if (row.location) items.push({ icon: <IconHome />, label: row.location });
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
  onOpenRecommended,
  onSaveJob,
  setSavingKey,
}: {
  row: UnifiedListing;
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  setSavingKey: (key: string | null) => void;
}) {
  const handleOpen = () => {
    onOpenRecommended(roleListingToVectorMatchedJob(row));
  };

  const handleSave = () => {
    const matchJob = roleListingToVectorMatchedJob(row);
    setSavingKey(row.dedupeKey);
    onSaveJob(matchJob).finally(() => setSavingKey(null));
  };

  const isSaving = savingKey === row.dedupeKey;

  const matchScore = row.matchScore ?? 0;
  const matchLabel = row.matchLabel ?? "";

  const postedDays = row.cached?.datePosted ? daysSincePosted(row.cached.datePosted) : null;
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
        borderRadius: 8,
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
          <>
              {/* Top badge row */}
              {(postedText || row.isTrackedCompany) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {postedText && (
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
                <CompanyLogo {...companyLogoFromJobData(row.companyName, row.cached)} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{row.title}</p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                    {row.companyName}
                  </p>
                  <MetadataGrid row={row} />
                </div>
              </div>
          </>
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
      {matchScore > 0 && (
        <MatchScoreColumn
          score={matchScore}
          label={matchLabel}
          reasons={row.matchReasons ?? []}
          matchedSkills={row.matchedSkills ?? []}
        />
      )}
    </div>
  );
}

function RecommendedResultsList({
  listings,
  savingKey,
  onOpenRecommended,
  onSaveJob,
  setSavingKey,
  emptyMessage,
}: {
  listings: UnifiedListing[];
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
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
          onOpenRecommended={onOpenRecommended}
          onSaveJob={onSaveJob}
          setSavingKey={setSavingKey}
        />
      ))}
    </div>
  );
}

export function PipelineRecommendedSection({
  pipelineCards,
  onOpenJob,
  onSaveJob,
  actingUserId,
}: {
  pipelineCards: KanbanCard[];
  onOpenJob: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  actingUserId?: string | null;
}) {
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
  const [profileCountry, setProfileCountry] = useState("");

  const [jobs, setJobs] = useState<VectorMatchedJob[]>(() => readDefaultFeedCache()?.jobs ?? []);
  const [loading, setLoading] = useState(() => !readDefaultFeedCache());
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(() => readDefaultFeedCache()?.error ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<{ fromSnapshot: boolean; generatedAt?: string } | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(readDefaultFeedCache()));
  const [trackedCompanyNames, setTrackedCompanyNames] = useState<string[]>([]);
  const [activeFilterLabels, setActiveFilterLabels] = useState<string[]>([]);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [profileFormReady, setProfileFormReady] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<RecommendedSortOption>("recommended");
  const [profileMeta, setProfileMeta] = useState<{
    userId: string | null;
    targetRoles: string[];
    prioritizedCategories: string[];
    searchPreferences: SearchPreferences;
  }>({ userId: null, targetRoles: [], prioritizedCategories: [], searchPreferences: {} });
  const [prefConfirmOpen, setPrefConfirmOpen] = useState(false);

  const initialFetchAttemptedRef = useRef(false);
  const prevActingUserIdRef = useRef<string | null | undefined>(undefined);
  const fetchGenRef = useRef(0);
  const defaultFormRef = useRef<FilterForm | null>(null);
  const prefsConfirmedRef = useRef(false);

  const hydrateFromCache = useCallback((filtersKey: string) => {
    const cached = readRecommendedCache(filtersKey);
    if (!cached) return false;
    setJobs(cached.jobs);
    setError(cached.error ?? null);
    setHasLoadedOnce(true);
    setLoading(false);
    return true;
  }, []);

  const hasActiveSearch = Boolean(appliedForm.semanticQuery.trim());
  const appliedFilters = useMemo(() => formToFilters(appliedForm, 1), [appliedForm]);

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
          signal: AbortSignal.timeout(90_000),
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
          } else {
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
            if (cacheKey === defaultFeedCacheKey() && nextJobs.length > 0) {
              markDefaultRecommendedFeedLoaded();
            }
          }
        }
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setError(formatApiErrorMessage(err, "Couldn't load recommended roles — hit Refresh."));
        if (!background) setJobs([]);
      } finally {
        if (gen === fetchGenRef.current) {
          setHasLoadedOnce(true);
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    [withClientScope, hasLoadedOnce],
  );

  useEffect(() => {
    void fetch(withClientScope("/api/jobs/recommended/defaults"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        filters?: VectorSearchFilters;
        labels?: string[];
        searchPreferences?: SearchPreferences;
      } | null) => {
        if (data?.filters) {
          const searchPrefs = data.searchPreferences ?? {};
          prefsConfirmedRef.current = Boolean(searchPrefs.opportunitiesPrefConfirmedAt);
          const profileForm = filtersToForm({ ...DEFAULT_VECTOR_SEARCH_FILTERS, ...data.filters }, searchPrefs);
          defaultFormRef.current = profileForm;
          setForm((prev) => ({ ...profileForm, semanticQuery: prev.semanticQuery || loadScopedSemanticQuery() }));
          if (prefsConfirmedRef.current) {
            const confirmedApplied = { ...profileForm, semanticQuery: "" };
            setAppliedForm(confirmedApplied);
            setActiveFilterLabels(describeActiveFilters(formToFilters(confirmedApplied, 1)));
          } else {
            // Unconfirmed profile prefill stays in form only until popup or filter bar apply.
            setAppliedForm(defaultFeedForm());
            setActiveFilterLabels([]);
          }
        } else {
          prefsConfirmedRef.current = false;
          setAppliedForm(defaultFeedForm());
        }
        setProfileFormReady(true);
        setDefaultsLoaded(true);
      })
      .catch(() => {
        setAppliedForm(defaultFeedForm());
        setProfileFormReady(true);
        setDefaultsLoaded(true);
      });

    void fetch(withClientScope("/api/jobs/categories"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { categories?: string[] } | null) => {
        if (data?.categories?.length) setCategorySuggestions(data.categories);
      })
      .catch(() => {});

    void fetch(withClientScope("/api/profile"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        userId?: string;
        parsedData?: Record<string, unknown> | null;
        priorities?: string[];
        targetRoles?: string[];
        prioritizedCategories?: string[];
      } | null) => {
        if (!data) return;
        const fields = locationFieldsFromProfileString(
          typeof data.parsedData?.location === "string" ? data.parsedData.location : null,
        );
        const priorities = Array.isArray(data.priorities) ? data.priorities : [];
        setProfileBaseline({
          location: fields.display,
          priorities: [...priorities],
        });
        setProfileCountry(fields.country);
        const searchPreferences = searchPreferencesFromParsedData(data.parsedData);
        setProfileMeta({
          userId: data.userId ?? actingUserId ?? null,
          targetRoles: data.targetRoles ?? [],
          prioritizedCategories: data.prioritizedCategories ?? [],
          searchPreferences,
        });
      })
      .catch(() => {});
  }, [actingUserId, withClientScope]);

  useEffect(() => {
    if (!hasLoadedOnce || !profileFormReady) return;
    const onboardingJustFinished =
      typeof window !== "undefined" &&
      sessionStorage.getItem("kimchi:onboarding-just-finished") === "1";
    if (
      shouldShowOpportunitiesPrefConfirm({
        userId: profileMeta.userId,
        targetRoles: profileMeta.targetRoles,
        prioritizedCategories: profileMeta.prioritizedCategories,
        searchPreferences: profileMeta.searchPreferences,
        onboardingJustFinished,
      })
    ) {
      setPrefConfirmOpen(true);
      if (onboardingJustFinished) sessionStorage.removeItem("kimchi:onboarding-just-finished");
    }
  }, [hasLoadedOnce, profileFormReady, profileMeta]);

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
    const prev = prevActingUserIdRef.current;
    const next = actingUserId ?? null;
    prevActingUserIdRef.current = next;
    if (prev === undefined) return;
    if (prev === next) return;

    // Profile resolves actingUserId after first paint — not an admin/client switch.
    if (prev === null && next !== null) {
      migrateRecommendedCacheScope("self", next);
      hydrateFromCache(defaultFeedCacheKey());
      return;
    }

    initialFetchAttemptedRef.current = false;
    setDefaultsLoaded(false);
    setProfileFormReady(false);
    defaultFormRef.current = null;
    clearRecommendedCache();
    setJobs([]);
    setHasLoadedOnce(false);
    setLoading(true);
    setError(null);
    setNotice(null);
    setActiveFilterLabels([]);
    const empty = filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS);
    setForm({ ...empty, semanticQuery: loadScopedSemanticQuery() });
    setAppliedForm({ ...empty, semanticQuery: "" });
  }, [actingUserId, hydrateFromCache]);

  useEffect(() => {
    if (initialFetchAttemptedRef.current || !defaultsLoaded || !profileFormReady) return;

    initialFetchAttemptedRef.current = true;

    const feedForm =
      prefsConfirmedRef.current && defaultFormRef.current
        ? { ...defaultFormRef.current, semanticQuery: "" }
        : defaultFeedForm();
    const defaultKey = filtersCacheKey(formToFilters(feedForm, 1));

    if (isAdminReviewing) {
      void fetchRecommended(feedForm, { preferCache: false, forceRefresh: true });
      return;
    }

    if (hydrateFromCache(defaultKey)) return;

    const isDefaultFeedRequest = isDefaultRecommendedFilters(formToFilters(feedForm, 1));
    if (isDefaultFeedRequest && hasDefaultRecommendedFeedLoaded()) {
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void fetchRecommended(feedForm, { preferCache: true });
  }, [fetchRecommended, defaultsLoaded, profileFormReady, isAdminReviewing, hydrateFromCache]);

  // Last-resort: never leave the initial loader spinning if bootstrap or fetch stalls.
  useEffect(() => {
    if (hasLoadedOnce) return;
    const timer = window.setTimeout(() => {
      setHasLoadedOnce(true);
      setLoading(false);
      setRevalidating(false);
      setError((prev) => prev ?? "Loading is taking longer than expected — hit Refresh or check your profile.");
    }, 90_000);
    return () => window.clearTimeout(timer);
  }, [hasLoadedOnce]);

  const saveProfileFromForm = useCallback(async (filtersForm: FilterForm, options?: { markPrefsConfirmed?: boolean }) => {
    const location = profileLocationFromForm(filtersForm);
    const priorities = profilePrioritiesFromForm(filtersForm);
    const searchPreferences = searchPreferencesFromFilterForm(filtersForm);
    if (
      options?.markPrefsConfirmed &&
      !searchPreferences.opportunitiesPrefConfirmedAt &&
      !profileMeta.searchPreferences.opportunitiesPrefConfirmedAt
    ) {
      searchPreferences.opportunitiesPrefConfirmedAt = new Date().toISOString();
    }
    const unchanged =
      profileBaseline &&
      location.trim() === (profileBaseline.location ?? "").trim() &&
      JSON.stringify([...priorities].sort()) === JSON.stringify([...profileBaseline.priorities].sort());
    const categories = splitInputList(filtersForm.jobCategories);

    const profileRes = await fetch(withClientScope("/api/profile"));
    const profile = (await profileRes.json().catch(() => ({}))) as {
      parsedData?: Record<string, unknown> | null;
      prioritizedCategories?: string[];
    };
    if (!profileRes.ok) return;

    const parsedData = patchParsedDataSearchPreferences(
      profile.parsedData && typeof profile.parsedData === "object" ? profile.parsedData : {},
      searchPreferences,
    );
    parsedData.location = location.trim() || null;

    const patch: Record<string, unknown> = { parsedData, priorities };
    if (categories.length) patch.prioritizedCategories = categories;

    if (unchanged && !categories.length) {
      // Still persist extended search prefs when only those changed
      const prevPrefs = searchPreferencesFromParsedData(profile.parsedData);
      if (JSON.stringify(prevPrefs) === JSON.stringify(searchPreferences)) return;
    }

    await fetch(withClientScope("/api/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setProfileBaseline({ location: location.trim(), priorities: [...priorities] });
    setProfileMeta((prev) => ({
      ...prev,
      prioritizedCategories: categories.length ? categories : prev.prioritizedCategories,
      searchPreferences: { ...prev.searchPreferences, ...searchPreferences },
    }));
  }, [profileBaseline, profileMeta.searchPreferences.opportunitiesPrefConfirmedAt, withClientScope]);

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };


  const applyFilters = async (filtersForm = form) => {
    await saveProfileFromForm(filtersForm, { markPrefsConfirmed: true });
    prefsConfirmedRef.current = true;
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
    void fetchRecommended(appliedForm, {
      forceRefresh: true,
      preferCache: false,
      background: false,
    });
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
    return [...byKey.values()];
  }, [jobs, savedKeys]);

  const hasExplicitAppliedFilters = !isDefaultRecommendedFilters(appliedFilters);
  const appliedFilterCount = useMemo(
    () => describeActiveFilters(appliedFilters).length,
    [appliedFilters],
  );

  const filteredListings = useMemo(() => {
    let list = [...recommendedListings];
    if (hasExplicitAppliedFilters) {
      list = filterRoleListings(list, appliedFilters, "all");
    }
    if (hasActiveSearch) {
      const query = appliedForm.semanticQuery.trim();
      return list.sort((a, b) => compareRoleSearchRelevance(a.title, b.title, query));
    }
    if (sortOption === "newest") {
      return list.sort((a, b) => {
        const da = a.cached?.datePosted ? new Date(a.cached.datePosted).getTime() : 0;
        const db = b.cached?.datePosted ? new Date(b.cached.datePosted).getTime() : 0;
        return db - da;
      });
    }
    return list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }, [recommendedListings, hasExplicitAppliedFilters, appliedFilters, hasActiveSearch, appliedForm.semanticQuery, sortOption]);

  const emptyMessage = error
    ? "Fix the issue above, then hit Refresh."
    : hasExplicitAppliedFilters
      ? "No roles matched your filters — try loosening location, experience, or category, or hit Refresh after clearing filters."
      : hasActiveSearch
        ? "Nothing matched — try different keywords or loosen your filters."
        : recommendedListings.length === 0 && jobs.length > 0
          ? "You've saved everything in today's list — check back after the daily refresh."
          : "No matches right now — add target roles or upload a resume under Profile, then refresh.";

  const showInitialLoader = (loading || revalidating) && !hasLoadedOnce;
  const showRefreshLoader = (loading || revalidating) && hasLoadedOnce && jobs.length > 0;

  return (
    <div>
      <ScoutBox padding={14} style={{ marginBottom: 12 }}>
        <ScoreExplainerLabel variant="vector-match">
          <ScoutLabel>Roles</ScoutLabel>
        </ScoreExplainerLabel>
        {hasLoadedOnce && !showInitialLoader && (
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "4px 0 8px", lineHeight: 1.45 }}>
            We found some roles for you — confirm these filters look right.
          </p>
        )}

        <OpportunitiesJobrightFilterBar
          form={form}
          appliedForm={appliedForm}
          setForm={setForm}
          toggleSet={toggleSet}
          categorySuggestions={categorySuggestions}
          onQuickApply={(nextForm) => void applyFilters(nextForm)}
          onOpenAllFilters={() => setFiltersDrawerOpen(true)}
          activeFilterCount={appliedFilterCount}
          searchValue={form.semanticQuery}
          onSearchChange={(value) => setForm((f) => ({ ...f, semanticQuery: value }))}
          onSearchSubmit={() => void applyFilters()}
          searching={loading || revalidating}
          profileCountry={profileCountry}
          trailingActions={
            <>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || revalidating}
                style={{
                  padding: "7px 14px",
                  background: "transparent",
                  color: "#161616",
                  border: "1.5px solid #161616",
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  cursor: loading || revalidating ? "not-allowed" : "pointer",
                  opacity: loading || revalidating ? 0.65 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {loading || revalidating ? "Loading…" : "Refresh"}
              </button>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as RecommendedSortOption)}
                aria-label="Sort results"
                style={{
                  ...inputStyle,
                  width: "auto",
                  minWidth: 120,
                  margin: 0,
                  padding: "7px 10px",
                  fontSize: T.label,
                  cursor: "pointer",
                }}
              >
                {RECOMMENDED_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          }
        />

        <OpportunitiesPrefConfirmModal
          open={prefConfirmOpen}
          userId={profileMeta.userId}
          input={{
            targetRoles: profileMeta.targetRoles,
            prioritizedCategories: profileMeta.prioritizedCategories,
            suggestedCategories: categorySuggestions.slice(0, 6),
            experienceLevelLabels: profileMeta.searchPreferences.experienceLevelLabels,
            roleMatchCount: profileMeta.targetRoles.length,
          }}
          onClose={() => setPrefConfirmOpen(false)}
          onConfirm={async ({ prioritizedCategories, searchPreferences }) => {
            const profileRes = await fetch(withClientScope("/api/profile"));
            const profile = (await profileRes.json().catch(() => ({}))) as {
              parsedData?: Record<string, unknown> | null;
            };
            if (!profileRes.ok) return;
            const parsedData = patchParsedDataSearchPreferences(profile.parsedData ?? {}, searchPreferences);
            await fetch(withClientScope("/api/profile"), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prioritizedCategories, parsedData }),
            });
            const mergedPrefs = { ...profileMeta.searchPreferences, ...searchPreferences };
            prefsConfirmedRef.current = true;
            setProfileMeta((prev) => ({
              ...prev,
              prioritizedCategories,
              searchPreferences: mergedPrefs,
            }));
            const base = defaultFormRef.current ?? form;
            const nextForm = applySearchPreferencesToFilterForm(
              {
                ...base,
                jobCategories: prioritizedCategories.join(", "),
              },
              mergedPrefs,
            );
            setForm(nextForm);
            defaultFormRef.current = nextForm;
            void applyFilters(nextForm);
          }}
        />

        <div style={{ marginTop: 6 }}>
          <JobFreshnessLegend compact />
        </div>


        <OpportunitiesAllFiltersModal
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          form={form}
          setForm={setForm}
          toggleSet={toggleSet}
          trackedCompanyNames={trackedCompanyNames}
          categorySuggestions={categorySuggestions}
          applying={loading || revalidating}
          appliedFilters={appliedFilters}
          onConfirm={() => {
            void applyFilters().then(() => setFiltersDrawerOpen(false));
          }}
        />


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
            setSavingKey={setSavingKey}
            emptyMessage={emptyMessage}
          />
        </>
      )}
    </div>
  );
}
