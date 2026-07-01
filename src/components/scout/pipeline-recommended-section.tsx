"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import {
  DEFAULT_VECTOR_SEARCH_FILTERS,
  VECTOR_SEARCH_RESULTS_MAX,
  type VectorMatchedJob,
  type VectorSearchFilters,
} from "@/lib/vector-matched-job";
import { cachedJobToMeta } from "@/lib/cached-job";
import {
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
  defaultLocationAllInCountry,
  RECOMMENDED_SORT_OPTIONS,
  type RecommendedSortOption,
} from "@/lib/recommended-filter-utils";
import { postedWithinDaysFormValue } from "@/lib/job-posted-filter";
import type { KanbanCard } from "./workspace-data";
import { useWorkspace } from "@/contexts/workspace-context";
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
import { RECOMMENDED_DISPLAY_COUNT } from "@/lib/recommended-jobs-config";
import { pipelineJobDedupeKeys, vectorMatchedJobDedupeKey } from "@/lib/pipeline-job-dedupe";
import {
  loadScopedSemanticQuery,
  saveScopedSemanticQuery,
} from "@/lib/client-session";
import { ScoutInsetBox } from "./scout-box";
import { fontSans, color, surface, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { daysSincePosted } from "@/lib/job-posted-freshness";
import { JobFreshnessLegend } from "./job-freshness-indicator";
import {
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";
import { OpportunitiesJobrightFilterBar } from "./opportunities-jobright-filter-bar";
import { OpportunitiesAllFiltersModal } from "./opportunities-all-filters-modal";
import { RecommendedJobCard } from "./recommended-job-card";
import { JR } from "@/lib/opportunities-jobright-tokens";
import { buildOpportunitiesFilterChips } from "@/lib/opportunities-filter-chips";
import {
  dismissOpportunitiesPrefConfirm,
  hasOpportunitiesSearchPrefs,
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

type ViewMode = "recommended" | "search";

type JobsApiResponse = {
  jobs?: VectorMatchedJob[];
  reserveJobs?: VectorMatchedJob[];
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
  const loc = f.locations?.[0];
  const locationAllInCountry =
    searchPrefs?.locationAllInCountry === true ||
    defaultLocationAllInCountry(searchPrefs, loc?.country);
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
    customJobFunctions: f.customJobFunctions ?? [],
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
    <div style={{ padding: 28, marginBottom: 12, background: JR.pageBg, borderRadius: JR.cardRadius }}>
      <KimchiProcessLoader preset="recommendations" variant="inline" fullWidth />
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
    days: daysSincePosted(job.datePosted) ?? 0,
    _url: job.url ?? undefined,
    _meta: meta,
  };
}

function syncRecommendedCache(
  jobs: VectorMatchedJob[],
  reserveJobs: VectorMatchedJob[],
  filtersKey: string,
  matchMode?: string,
) {
  writeRecommendedCache({
    jobs,
    reserveJobs,
    filtersKey,
    fetchedAt: Date.now(),
    matchMode,
    error: null,
  });
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
      <div
        style={{
          padding: 40,
          textAlign: "center",
          background: JR.cardBg,
          borderRadius: JR.cardRadius,
        }}
      >
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: JR.textMuted, margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
  const { withClientScope, isAdminReviewing } = useWorkspace();
  const [form, setForm] = useState(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: loadScopedSemanticQuery(),
  }));
  const [appliedForm, setAppliedForm] = useState<FilterForm>(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: "",
  }));
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const drawerAppliedSnapshotRef = useRef<FilterForm | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<RecommendationPreferencesState | null>(null);
  const [profileCountry, setProfileCountry] = useState("");

  const [jobs, setJobs] = useState<VectorMatchedJob[]>(() => readDefaultFeedCache()?.jobs ?? []);
  const [reserveJobs, setReserveJobs] = useState<VectorMatchedJob[]>(() => readDefaultFeedCache()?.reserveJobs ?? []);
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
    experienceLevel: string | null;
    searchPreferences: SearchPreferences;
  }>({
    userId: null,
    targetRoles: [],
    prioritizedCategories: [],
    experienceLevel: null,
    searchPreferences: {},
  });
  const [prefConfirmOpen, setPrefConfirmOpen] = useState(false);
  const [profileMetaLoaded, setProfileMetaLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("recommended");

  const initialFetchAttemptedRef = useRef(false);
  const prevActingUserIdRef = useRef<string | null | undefined>(undefined);
  const fetchGenRef = useRef(0);
  const defaultFormRef = useRef<FilterForm | null>(null);
  const prefsConfirmedRef = useRef(false);
  const prefConfirmHandledRef = useRef(false);
  const prefConfirmMigratedRef = useRef(false);

  const hydrateFromCache = useCallback((filtersKey: string) => {
    const cached = readRecommendedCache(filtersKey);
    if (!cached) return false;
    setJobs(cached.jobs);
    setReserveJobs(cached.reserveJobs ?? []);
    setError(cached.error ?? null);
    setHasLoadedOnce(true);
    setLoading(false);
    return true;
  }, []);

  const hasActiveSearch = viewMode === "search";

  const fetchRecommendedRef = useRef<
    ((options?: { forceRefresh?: boolean; preferCache?: boolean; background?: boolean }) => Promise<void>) | null
  >(null);

  const fetchRecommended = useCallback(
    async (options?: { forceRefresh?: boolean; preferCache?: boolean; background?: boolean }) => {
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

      try {
        const res = await fetch(withClientScope("/api/jobs/recommended"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: forceRefresh ? "no-store" : "default",
          signal: AbortSignal.timeout(115_000),
          body: JSON.stringify({
            preferCache: options?.preferCache ?? !forceRefresh,
            forceRefresh,
          }),
        });
        const data = (await res.json()) as JobsApiResponse;
        if (gen !== fetchGenRef.current) return;

        const cacheKey = defaultFeedCacheKey();

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
          if (!background) setJobs([]);
          writeRecommendedCache({
            jobs: [],
            reserveJobs: [],
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            error: msg,
          });
        } else {
          const nextJobs = data.jobs ?? [];
          const nextReserve = data.reserveJobs ?? [];
          const snapshotPending =
            nextJobs.length === 0 &&
            data.needsRefresh === true &&
            !forceRefresh &&
            (options?.preferCache ?? true);

          if (snapshotPending) {
            void fetchRecommendedRef.current?.({
              preferCache: false,
              background: background || hasLoadedOnce,
            });
          } else {
            setJobs(nextJobs);
            setReserveJobs(nextReserve);
            setError(null);
            setNotice(data.notice?.trim() || null);
            const applied = data.effectiveFilters ?? data.filtersApplied;
            if (applied) setActiveFilterLabels(describeActiveFilters(applied));
            setSnapshotMeta({
              fromSnapshot: data.fromSnapshot === true,
              generatedAt: data.generatedAt ?? new Date().toISOString(),
            });
            syncRecommendedCache(nextJobs, nextReserve, cacheKey, data.matchMode);
            if (nextJobs.length > 0) {
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
    fetchRecommendedRef.current = fetchRecommended;
  }, [fetchRecommended]);

  const fetchSearch = useCallback(
    async (filtersForm: FilterForm, options?: { background?: boolean }) => {
      const filters = formToFilters(filtersForm, 1);
      const cacheKey = filtersCacheKey(filters);
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
        const res = await fetch(withClientScope("/api/jobs/search"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(115_000),
          body: JSON.stringify(filters),
        });
        const data = (await res.json()) as JobsApiResponse;
        if (gen !== fetchGenRef.current) return;

        if (!res.ok) {
          const msg = formatApiErrorMessage(data.error, "Couldn't run job search.");
          setError(data.hint ? `${msg} ${data.hint}` : msg);
          setNotice(null);
          if (!background) setJobs([]);
        } else {
          const nextJobs = data.jobs ?? [];
          setJobs(nextJobs);
          setReserveJobs([]);
          setError(null);
          setNotice(data.notice?.trim() || null);
          const applied = data.effectiveFilters ?? data.filtersApplied ?? filters;
          setActiveFilterLabels(describeActiveFilters(applied));
          setSnapshotMeta(null);
          writeRecommendedCache({
            jobs: nextJobs,
            filtersKey: cacheKey,
            fetchedAt: Date.now(),
            matchMode: data.matchMode,
            error: null,
          });
        }
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setError(formatApiErrorMessage(err, "Couldn't run job search — try again."));
        if (!background) setJobs([]);
      } finally {
        if (gen === fetchGenRef.current) {
          setHasLoadedOnce(true);
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
          const confirmedApplied = { ...profileForm, semanticQuery: "" };
          setAppliedForm(confirmedApplied);
          setActiveFilterLabels(describeActiveFilters(formToFilters(confirmedApplied, 1)));
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
        if (data) {
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
          const experienceLevel =
            typeof data.parsedData?.experienceLevel === "string" ? data.parsedData.experienceLevel : null;
          setProfileMeta({
            userId: data.userId ?? actingUserId ?? null,
            targetRoles: data.targetRoles ?? [],
            prioritizedCategories: data.prioritizedCategories ?? [],
            experienceLevel,
            searchPreferences,
          });
        }
      })
      .catch(() => {})
      .finally(() => setProfileMetaLoaded(true));
  }, [actingUserId, withClientScope]);

  useEffect(() => {
    if (!hasLoadedOnce || !profileFormReady || !profileMetaLoaded) return;
    if (prefConfirmHandledRef.current) return;
    const onboardingJustFinished =
      typeof window !== "undefined" &&
      sessionStorage.getItem("kimchi:onboarding-just-finished") === "1";
    const shouldShow = shouldShowOpportunitiesPrefConfirm({
      userId: profileMeta.userId,
      targetRoles: profileMeta.targetRoles,
      prioritizedCategories: profileMeta.prioritizedCategories,
      experienceLevel: profileMeta.experienceLevel,
      searchPreferences: profileMeta.searchPreferences,
      onboardingJustFinished,
    });
    if (shouldShow) {
      setPrefConfirmOpen(true);
      if (onboardingJustFinished) sessionStorage.removeItem("kimchi:onboarding-just-finished");
    } else {
      prefConfirmHandledRef.current = true;
      setPrefConfirmOpen(false);
    }
  }, [hasLoadedOnce, profileFormReady, profileMetaLoaded, profileMeta]);

  // Existing users with complete prefs but no confirm timestamp — migrate silently once.
  useEffect(() => {
    if (!profileMetaLoaded || prefConfirmMigratedRef.current) return;
    if (profileMeta.searchPreferences.opportunitiesPrefConfirmedAt) return;
    if (!hasOpportunitiesSearchPrefs(profileMeta)) return;

    prefConfirmMigratedRef.current = true;
    prefsConfirmedRef.current = true;
    setPrefConfirmOpen(false);

    const confirmedAt = new Date().toISOString();
    void (async () => {
      try {
        const profileRes = await fetch(withClientScope("/api/profile"));
        const profile = (await profileRes.json().catch(() => ({}))) as {
          parsedData?: Record<string, unknown> | null;
        };
        if (!profileRes.ok) return;
        const parsedData = patchParsedDataSearchPreferences(profile.parsedData ?? {}, {
          opportunitiesPrefConfirmedAt: confirmedAt,
        });
        const patchRes = await fetch(withClientScope("/api/profile"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedData }),
        });
        if (!patchRes.ok) return;
        setProfileMeta((prev) => ({
          ...prev,
          searchPreferences: {
            ...prev.searchPreferences,
            opportunitiesPrefConfirmedAt: confirmedAt,
          },
        }));
      } catch {
        /* non-blocking migration */
      }
    })();
  }, [profileMetaLoaded, profileMeta, withClientScope]);

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
    setProfileMetaLoaded(false);
    defaultFormRef.current = null;
    prefConfirmHandledRef.current = false;
    prefConfirmMigratedRef.current = false;
    setPrefConfirmOpen(false);
    clearRecommendedCache();
    setJobs([]);
    setReserveJobs([]);
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

    if (isAdminReviewing) {
      void fetchRecommended({ preferCache: false, forceRefresh: true });
      return;
    }

    if (hydrateFromCache(defaultFeedCacheKey())) return;

    if (hasDefaultRecommendedFeedLoaded()) {
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void fetchRecommended({ preferCache: true });
  }, [fetchRecommended, defaultsLoaded, profileFormReady, isAdminReviewing, hydrateFromCache]);

  // Last-resort: never leave the initial loader spinning if bootstrap or fetch stalls.
  useEffect(() => {
    if (hasLoadedOnce) return;
    const timer = window.setTimeout(() => {
      setHasLoadedOnce(true);
      setLoading(false);
      setRevalidating(false);
      setError((prev) => prev ?? "Loading is taking longer than expected — hit Refresh or check your profile.");
    }, 115_000);
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
    setViewMode("search");
    void fetchSearch(filtersForm, { background: jobs.length > 0 });
  };

  const clearSearch = () => {
    const profileForm = defaultFormRef.current ?? defaultFeedForm();
    setForm((f) => ({ ...profileForm, semanticQuery: "" }));
    setAppliedForm({ ...profileForm, semanticQuery: "" });
    setActiveFilterLabels(describeActiveFilters(formToFilters(profileForm, 1)));
    setViewMode("recommended");
    setError(null);
    setNotice(null);
    if (hydrateFromCache(defaultFeedCacheKey())) return;
    void fetchRecommended({ preferCache: true, background: jobs.length > 0 });
  };

  const handleRefresh = () => {
    clearRecommendedCacheForKey(filtersCacheKey(formToFilters(appliedForm, 1)));
    if (viewMode === "search") {
      void fetchSearch(appliedForm, { background: false });
    } else {
      void fetchRecommended({
        forceRefresh: true,
        preferCache: false,
        background: false,
      });
    }
  };

  const savedKeys = useMemo(() => pipelineJobDedupeKeys(pipelineCards), [pipelineCards]);

  const recommendationPool = useMemo(() => {
    const byKey = new Map<string, VectorMatchedJob>();
    for (const job of [...jobs, ...reserveJobs]) {
      const key = vectorMatchedJobDedupeKey(job);
      const existing = byKey.get(key);
      if (!existing || (job.matchScore ?? 0) > (existing.matchScore ?? 0)) {
        byKey.set(key, job);
      }
    }
    return [...byKey.values()];
  }, [jobs, reserveJobs]);

  const recommendedListings = useMemo(() => {
    const byKey = new Map<string, UnifiedListing>();
    for (const job of recommendationPool) {
      if (savedKeys.has(vectorMatchedJobDedupeKey(job))) continue;
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
  }, [recommendationPool, savedKeys]);

  const appliedFilterCount = useMemo(
    () =>
      buildOpportunitiesFilterChips(appliedForm, {
        excludeTargetRoleBleed: profileMeta.targetRoles,
      }).length,
    [appliedForm, profileMeta.targetRoles],
  );

  const filteredListings = useMemo(() => {
    let list = [...recommendedListings];
    if (hasActiveSearch && appliedForm.semanticQuery.trim()) {
      const query = appliedForm.semanticQuery.trim();
      list = list.sort((a, b) => compareRoleSearchRelevance(a.title, b.title, query));
    } else if (sortOption === "newest") {
      list = list.sort((a, b) => {
        const da = a.cached?.datePosted ? new Date(a.cached.datePosted).getTime() : 0;
        const db = b.cached?.datePosted ? new Date(b.cached.datePosted).getTime() : 0;
        return db - da;
      });
    } else {
      list = list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }
    return list.slice(0, RECOMMENDED_DISPLAY_COUNT);
  }, [recommendedListings, hasActiveSearch, appliedForm.semanticQuery, sortOption]);

  const emptyMessage = error
    ? "Fix the issue above, then hit Refresh."
    : viewMode === "search"
      ? "No roles matched your filters — try loosening location, experience, or job function, or clear search to return to your feed."
      : recommendedListings.length === 0 && jobs.length > 0
        ? "You've saved everything in today's list — check back after the daily refresh."
        : "No matches right now — add target roles or job functions under Profile, then refresh.";

  const showInitialLoader = (loading || revalidating) && !hasLoadedOnce;
  const showRefreshLoader = (loading || revalidating) && hasLoadedOnce && jobs.length > 0;

  const jrActionBtn: React.CSSProperties = {
    padding: "7px 14px",
    background: JR.cardBg,
    color: JR.text,
    border: `1px solid ${JR.border}`,
    borderRadius: JR.pillRadius,
    fontFamily: fontSans,
    fontSize: T.label,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div>
      <div
        style={{
          background: JR.cardBg,
          borderRadius: JR.cardRadius,
          padding: "14px 16px",
          marginBottom: 10,
        }}
      >
        {hasLoadedOnce && !showInitialLoader && (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 15,
              fontWeight: 600,
              color: JR.text,
              margin: "0 0 10px",
              lineHeight: 1.35,
            }}
          >
            {viewMode === "search"
              ? `Search results (${filteredListings.length})`
              : "Recommended"}
          </p>
        )}
        {hasLoadedOnce && !showInitialLoader && viewMode === "recommended" && (
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: JR.textMuted, margin: "0 0 10px", lineHeight: 1.45 }}>
            Roles matched to your profile filters, ranked by fit.
          </p>
        )}

        <OpportunitiesJobrightFilterBar
          form={form}
          appliedForm={appliedForm}
          setForm={setForm}
          toggleSet={toggleSet}
          categorySuggestions={categorySuggestions}
          onQuickApply={(nextForm) => void applyFilters(nextForm)}
          onOpenAllFilters={() => {
            drawerAppliedSnapshotRef.current = appliedForm;
            setForm((f) => ({ ...appliedForm, semanticQuery: f.semanticQuery }));
            setFiltersDrawerOpen(true);
          }}
          activeFilterCount={appliedFilterCount}
          searchValue={form.semanticQuery}
          onSearchChange={(value) => setForm((f) => ({ ...f, semanticQuery: value }))}
          onSearchSubmit={() => void applyFilters()}
          searching={loading || revalidating}
          profileCountry={profileCountry}
          trailingActions={
            <>
              {viewMode === "search" && (
                <button
                  type="button"
                  onClick={clearSearch}
                  disabled={loading || revalidating}
                  style={{
                    ...jrActionBtn,
                    cursor: loading || revalidating ? "not-allowed" : "pointer",
                    opacity: loading || revalidating ? 0.65 : 1,
                  }}
                >
                  Clear search
                </button>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || revalidating}
                style={{
                  ...jrActionBtn,
                  cursor: loading || revalidating ? "not-allowed" : "pointer",
                  opacity: loading || revalidating ? 0.65 : 1,
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
                  borderRadius: JR.pillRadius,
                  border: `1px solid ${JR.border}`,
                  background: JR.cardBg,
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
            experienceLevel: profileMeta.experienceLevel,
            roleMatchCount: profileMeta.targetRoles.length,
          }}
          onClose={() => {
            prefConfirmHandledRef.current = true;
            dismissOpportunitiesPrefConfirm(profileMeta.userId);
            setPrefConfirmOpen(false);
          }}
          onConfirm={async ({ prioritizedCategories, searchPreferences }) => {
            const profileRes = await fetch(withClientScope("/api/profile"));
            const profile = (await profileRes.json().catch(() => ({}))) as {
              parsedData?: Record<string, unknown> | null;
            };
            if (!profileRes.ok) throw new Error("Failed to load profile");
            const parsedData = patchParsedDataSearchPreferences(profile.parsedData ?? {}, searchPreferences);
            const patchRes = await fetch(withClientScope("/api/profile"), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prioritizedCategories, parsedData }),
            });
            if (!patchRes.ok) throw new Error("Failed to save preferences");
            const mergedPrefs = { ...profileMeta.searchPreferences, ...searchPreferences };
            prefConfirmHandledRef.current = true;
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
            setAppliedForm({ ...nextForm, semanticQuery: "" });
            setViewMode("recommended");
            void fetchRecommended({ preferCache: false, forceRefresh: true });
          }}
        />

        <div style={{ marginTop: 6 }}>
          <JobFreshnessLegend compact />
        </div>


        <OpportunitiesAllFiltersModal
          open={filtersDrawerOpen}
          onClose={() => {
            if (drawerAppliedSnapshotRef.current) {
              const snapshot = drawerAppliedSnapshotRef.current;
              setForm((f) => ({ ...snapshot, semanticQuery: f.semanticQuery }));
            }
            drawerAppliedSnapshotRef.current = null;
            setFiltersDrawerOpen(false);
          }}
          form={form}
          appliedForm={appliedForm}
          setForm={setForm}
          toggleSet={toggleSet}
          trackedCompanyNames={trackedCompanyNames}
          categorySuggestions={categorySuggestions}
          applying={loading || revalidating}
          excludeTargetRoleBleed={profileMeta.targetRoles}
          onResetAll={() => {
            const empty = defaultFeedForm();
            setForm((f) => ({ ...empty, semanticQuery: f.semanticQuery }));
          }}
          onConfirm={() => {
            void applyFilters(form).then(() => {
              drawerAppliedSnapshotRef.current = null;
              setFiltersDrawerOpen(false);
            });
          }}
        />


        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{error}</p>
        )}
        {notice && (
          <ScoutInsetBox style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.caption, color: JR.textMuted, lineHeight: 1.45 }}>
            {notice}
          </ScoutInsetBox>
        )}
      </div>

      <div
        style={{
          background: JR.pageBg,
          borderRadius: JR.cardRadius,
          padding: 10,
        }}
      >
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
    </div>
  );
}
