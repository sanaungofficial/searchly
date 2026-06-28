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
import {
  filtersCacheKey,
  readRecommendedCache,
  writeRecommendedCache,
  clearRecommendedCacheForKey,
  clearRecommendedCache,
  type RecommendedCacheEntry,
} from "@/lib/recommended-jobs-cache";
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
import { ScoutBox, ScoutInsetBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn, scoutInsetChipStyle } from "./scout-box";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { MatchFitCallout, MatchScoreBadge, ScoreSourceHint } from "./match-score-ui";
import { matchScoreStyle } from "@/lib/match-score";
import { daysSincePosted } from "@/lib/job-posted-freshness";
import { JobFreshnessIndicator, JobFreshnessLegend } from "./job-freshness-indicator";
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
  border: border.line,
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
      <ScoutBox style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>{emptyMessage}</p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {listings.map((row) => {
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
        const score = matchScoreStyle(matchScore);

        return (
          <ScoutBox key={row.dedupeKey} padding={18}>
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
              <CompanyLogo {...(isNetwork ? { name: row.companyName, size: 44 } : { ...companyLogoFromJobData(row.companyName, row.cached), size: 44 })} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{row.title}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px" }}>
                      {row.companyName}
                      {row.location ? ` · ${row.location}` : ""}
                    </p>
                    <div style={{ marginBottom: 8 }}>
                      {isNetwork && networkJob?.sharedAt ? (
                        <span style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted }}>
                          Shared {networkJob.sharedAtRelative || networkJob.sharedAtLabel}
                        </span>
                      ) : (
                        <JobFreshnessIndicator datePosted={row.cached.datePosted} variant="compact" />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {isNetwork && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            fontSize: T.bodySm,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: "#7A4F00",
                            background: "rgba(196,140,40,0.18)",
                            border: "1.5px solid rgba(196,140,40,0.5)",
                            borderRadius: "var(--scout-radius)",
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
                            padding: "2px 8px",
                            fontSize: T.label,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: color.forest,
                            background: "rgba(26,58,47,0.08)",
                            border: border.lineStrong,
                          }}
                        >
                          Watchlist
                        </span>
                      )}
                    </div>
                  </div>
                  {matchScore > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <ScoreExplainerPopover variant={isNetwork ? "network-match" : "vector-match"} align="right" />
                      <MatchScoreBadge score={matchScore} label={matchLabel} />
                      <ScoreSourceHint />
                    </div>
                  )}
                </div>
                {matchScore > 0 && <MatchFitCallout job={isNetwork ? networkJob! : roleListingToVectorMatchedJob(row)} />}
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap", alignItems: "center" }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <ScoutPrimaryBtn onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save job"}
              </ScoutPrimaryBtn>
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
  const [networkJobs, setNetworkJobs] = useState<NetworkMatchedJob[]>([]);
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
    fetch(withClientScope("/api/network-jobs/match?limit=50"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { jobs?: NetworkMatchedJob[] } | null) => {
        if (data?.jobs) setNetworkJobs(data.jobs);
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
          <ScoutSecondaryBtn onClick={handleRefresh} disabled={loading || revalidating} style={{ alignSelf: isMobile ? "flex-start" : "flex-end" }}>
            {loading || revalidating ? "Loading…" : "Refresh"}
          </ScoutSecondaryBtn>
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
          <ScoutPrimaryBtn
            onClick={() => applyFilters()}
            disabled={loading || revalidating}
            style={{ flexShrink: 0, minWidth: isMobile ? undefined : 96 }}
          >
            {loading || revalidating ? "Loading…" : "Search"}
          </ScoutPrimaryBtn>
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
