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
  roleListingToVectorMatchedJob,
  vectorJobToRoleListing,
  type RoleListing,
} from "@/lib/role-listings";
import { normalizeJobUrl } from "@/lib/cached-job";
import type { RecommendationPreferencesState } from "@/lib/recommendation-preferences";
import {
  describeActiveFilters,
  HIREBASE_FILTER_COUNTRIES,
  HIREBASE_FILTER_US_STATES,
  locationFieldsFromProfileString,
} from "@/lib/recommended-filter-utils";
import type { KanbanCard } from "./workspace-data";
import {
  filtersCacheKey,
  readRecommendedCache,
  writeRecommendedCache,
} from "@/lib/recommended-jobs-cache";
import {
  loadScopedSemanticQuery,
  saveScopedSemanticQuery,
} from "@/lib/client-session";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { MatchFitCallout, MatchScoreBadge } from "./match-score-ui";
import { matchScoreStyle } from "@/lib/match-score";

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
  generatedAt?: string;
  snapshotDate?: string;
  scoreFloor?: number;
  retryAfterMs?: number;
  filtersApplied?: VectorSearchFilters;
  effectiveFilters?: VectorSearchFilters;
};

function ActiveFiltersBar({
  labels,
  onClear,
}: {
  labels: string[];
  onClear?: () => void;
}) {
  if (!labels.length) return null;
  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: surface.inset, border: border.line }}>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px", letterSpacing: "0.04em" }}>
        Active search filters
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: onClear ? 8 : 0 }}>
        {labels.map((label) => (
          <span
            key={label}
            style={{
              padding: "3px 8px",
              border: border.line,
              fontFamily: fontSans,
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
    </div>
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
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: isMobile ? "12px 0" : "0 16px", marginTop: 8, paddingTop: 16, borderTop: border.line }}>
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
          options={HIREBASE_FILTER_US_STATES}
          placeholder="California"
        />
      </FilterField>
      <FilterField label="Country">
        <DatalistInput
          value={form.locationCountry}
          onChange={(locationCountry) => setForm((f) => ({ ...f, locationCountry }))}
          listId="recommended-country-suggestions"
          options={[...HIREBASE_FILTER_COUNTRIES]}
          placeholder="United States"
        />
      </FilterField>
      <FilterField label="Posted after">
        <input type="date" style={inputStyle} value={form.datePostedFrom} onChange={(e) => setForm((f) => ({ ...f, datePostedFrom: e.target.value }))} />
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "4px 0 0", lineHeight: 1.4 }}>
          Leave empty to include all posts in our index — not just recent ones.
        </p>
      </FilterField>
      <FilterField label="Salary from ($)">
        <input
          type="number"
          style={inputStyle}
          value={form.salaryFrom}
          onChange={(e) => setForm((f) => ({ ...f, salaryFrom: e.target.value }))}
          placeholder="150000"
          min={0}
        />
      </FilterField>
      <FilterField label="Salary to ($)">
        <input
          type="number"
          style={inputStyle}
          value={form.salaryTo}
          onChange={(e) => setForm((f) => ({ ...f, salaryTo: e.target.value }))}
          placeholder="250000"
          min={0}
        />
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

function RecommendedLoadingSkeleton() {
  const barWidths = ["72%", "58%", "84%", "64%"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <KimchiProcessLoader preset="recommendations" variant="inline" />
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

function recommendedDedupeKey(job: VectorMatchedJob): string {
  return normalizeJobUrl(job.url) ?? `${job.companyName.trim()}:${job.title.trim()}`.toLowerCase();
}

function RecommendedResultsList({
  listings,
  savingKey,
  onOpenRecommended,
  onSaveJob,
  setSavingKey,
  emptyMessage,
}: {
  listings: RoleListing[];
  savingKey: string | null;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
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
        const matchJob = roleListingToVectorMatchedJob(row);
        const score = matchScoreStyle(matchJob.matchScore);

        return (
          <ScoutBox key={row.dedupeKey} stack padding={18} style={{ borderTop: `2px solid ${score.accent}` }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenRecommended(matchJob)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenRecommended(matchJob);
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
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                      {row.isTrackedCompany && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            border: border.lineStrong,
                            fontFamily: fontSans,
                            fontSize: T.label,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: color.forest,
                            background: "rgba(26,58,47,0.08)",
                          }}
                        >
                          Watchlist
                        </span>
                      )}
                    </div>
                  </div>
                  {matchJob.matchScore > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <ScoreExplainerPopover variant="vector-match" align="right" />
                      <MatchScoreBadge score={matchJob.matchScore} label={matchJob.matchLabel} />
                    </div>
                  )}
                </div>
                {matchJob.matchScore > 0 && <MatchFitCallout job={matchJob} />}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap", alignItems: "center" }}>
              <ScoutPrimaryBtn
                onClick={(e) => {
                  e.stopPropagation();
                  const saveKey = row.dedupeKey;
                  setSavingKey(saveKey);
                  onSaveJob(matchJob).finally(() => setSavingKey(null));
                }}
                disabled={savingKey === row.dedupeKey}
              >
                {savingKey === row.dedupeKey ? "Saving…" : "Save to pipeline"}
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
  actingUserId,
  locationPrefs,
  preferencesRefreshKey = 0,
}: {
  /** Used only to hide roles already saved to the pipeline. */
  pipelineCards: KanbanCard[];
  onOpenJob: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  actingUserId?: string | null;
  locationPrefs?: RecommendationPreferencesState | null;
  /** Increment to refetch after inline preference changes. */
  preferencesRefreshKey?: number;
}) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: loadScopedSemanticQuery(),
  }));
  const [appliedForm, setAppliedForm] = useState<FilterForm>(() => ({
    ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
    semanticQuery: "",
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  const mountedRef = useRef(false);
  const fetchGenRef = useRef(0);
  const defaultFormRef = useRef<FilterForm | null>(null);

  const hasActiveSearch = Boolean(appliedForm.semanticQuery.trim());
  const hasSearchFilters = activeFilterLabels.length > 0;

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
          const rawMsg = formatApiErrorMessage(data.error, "Could not load recommended jobs.");
          const isEmbedNoise =
            /embed|artifact|hirebase|permission|forbidden|403|vector/i.test(rawMsg);
          const msg = isEmbedNoise ? null : data.hint ? `${rawMsg} ${data.hint}` : rawMsg;
          setError(msg);
          setNotice(null);
          const applied = data.effectiveFilters ?? data.filtersApplied;
          if (applied) {
            setActiveFilterLabels(describeActiveFilters(applied));
          }
          if (msg) setShowFilters(true);
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
          setNotice(data.notice?.trim() || null);
          const applied = data.effectiveFilters ?? data.filtersApplied ?? filters;
          setActiveFilterLabels(describeActiveFilters(applied));
          setSnapshotMeta({
            fromSnapshot: data.fromSnapshot === true,
            generatedAt: data.generatedAt,
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
        setError(formatApiErrorMessage(err, "Could not load recommended jobs — try Refresh."));
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
    void fetch("/api/jobs/recommended/defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { filters?: VectorSearchFilters; labels?: string[] } | null) => {
        if (!data?.filters) {
          setDefaultsLoaded(true);
          return;
        }
        const base = filtersToForm({ ...DEFAULT_VECTOR_SEARCH_FILTERS, ...data.filters });
        defaultFormRef.current = base;
        const empty = filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS);
        setForm({
          ...empty,
          semanticQuery: loadScopedSemanticQuery(),
          locationCity: base.locationCity,
          locationRegion: base.locationRegion,
          locationCountry: base.locationCountry,
        });
        setProfileSuggestedLabels(data.labels ?? describeActiveFilters(data.filters));
        setDefaultsLoaded(true);
      })
      .catch(() => setDefaultsLoaded(true));
  }, [actingUserId]);

  useEffect(() => {
    if (!locationPrefs?.location?.trim()) return;
    const fields = locationFieldsFromProfileString(locationPrefs.location);
    setForm((f) => ({
      ...f,
      locationCity: fields.city,
      locationRegion: fields.region,
      locationCountry: fields.country,
    }));
  }, [locationPrefs?.location]);

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
  }, [actingUserId]);

  useEffect(() => {
    mountedRef.current = false;
    setDefaultsLoaded(false);
    defaultFormRef.current = null;
    const cached = readDefaultFeedCache();
    setJobs(cached?.jobs ?? []);
    setHasLoadedOnce(Boolean(cached));
    setLoading(!cached);
    setError(cached?.error ?? null);
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
    const cacheKey = defaultFeedCacheKey();
    const cached = readRecommendedCache(cacheKey);

    if (cached) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void fetchRecommended(feedForm, { preferCache: true });
  }, [fetchRecommended, actingUserId, defaultsLoaded]);

  useEffect(() => {
    if (preferencesRefreshKey <= 0) return;
    // Preferences saved — update filter form from profile location only; user clicks Refresh for live Hirebase.
    const defaultForm: FilterForm = {
      ...filtersToForm(DEFAULT_VECTOR_SEARCH_FILTERS),
      semanticQuery: appliedForm.semanticQuery,
    };
    setAppliedForm(defaultForm);
  }, [preferencesRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const applyProfileSuggestions = () => {
    const suggested = defaultFormRef.current;
    if (!suggested) return;
    setForm({ ...suggested, semanticQuery: form.semanticQuery });
    setShowFilters(true);
  };

  const applyFilters = (filtersForm = form) => {
    setAppliedForm(filtersForm);
    const cacheKey = filtersCacheKey(formToFilters(filtersForm, 1));
    const isDefaultFeed =
      cacheKey === defaultFeedCacheKey() && !filtersForm.semanticQuery.trim();

    if (isDefaultFeed) {
      const cached = readRecommendedCache(cacheKey);
      if (cached) {
        setJobs(cached.jobs);
        setError(cached.error ?? null);
        setHasLoadedOnce(true);
        setLoading(false);
        return;
      }
      void fetchRecommended(filtersForm, { preferCache: true });
      return;
    }

    void fetchRecommended(filtersForm, {
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

  const showInitialSkeleton = loading && !hasLoadedOnce && !jobs.length;

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
    const reset: FilterForm = defaultFormRef.current ?? defaultFeedForm();
    setForm({ ...reset, semanticQuery: "" });
    setAppliedForm(reset);
    saveScopedSemanticQuery("");
    setShowFilters(true);
    const cached = readRecommendedCache(defaultFeedCacheKey());
    if (cached) {
      setJobs(cached.jobs);
      setError(cached.error ?? null);
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }
    void fetchRecommended(reset, { preferCache: true });
  };

  const recommendedListings = useMemo(
    () =>
      jobs
        .filter((job) => !savedKeys.has(recommendedDedupeKey(job)))
        .map((job) => vectorJobToRoleListing(job)),
    [jobs, savedKeys],
  );

  const filteredListings = useMemo(
    () => filterRoleListings(recommendedListings, formToFilters(appliedForm, 1), "all"),
    [recommendedListings, appliedForm],
  );

  const emptyMessage = error
    ? "Fix the issue above, then refresh."
    : hasActiveSearch
      ? "No roles matched your search — try different keywords or broaden filters."
      : recommendedListings.length === 0 && jobs.length > 0
        ? "You have saved all current recommendations — check back after the daily refresh."
        : "No recommendations right now — add target roles or a resume under Profile, then refresh.";

  return (
    <div>
      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoreExplainerLabel variant="vector-match">
              <ScoutLabel>Recommended roles</ScoutLabel>
            </ScoreExplainerLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              Fresh roles matched to your profile from Hirebase — remote and local to your area. Save any role to track it in your pipeline.
            </p>
            {snapshotMeta?.generatedAt && (
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "6px 0 0" }}>
                {snapshotMeta.fromSnapshot ? "Daily snapshot" : "Live results"} · updated{" "}
                {new Date(snapshotMeta.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
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

        {showFilters && profileSuggestedLabels.length > 0 && !hasSearchFilters && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: surface.inset, border: border.line }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.muted, margin: 0 }}>
                Suggested from your profile
              </p>
              <ScoutSecondaryBtn onClick={applyProfileSuggestions} style={{ padding: "4px 10px", fontSize: T.label }}>
                Apply suggestions
              </ScoutSecondaryBtn>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "0 0 8px", lineHeight: 1.45 }}>
              Optional — edit salary and dates below before you search. Clear &quot;Posted after&quot; to see all indexed roles.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profileSuggestedLabels.map((label) => (
                <span
                  key={label}
                  style={{
                    padding: "3px 8px",
                    border: border.line,
                    fontFamily: fontSans,
                    fontSize: T.label,
                    color: color.muted,
                    background: surface.card,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {showFilters && (
          <>
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "12px 0 0", lineHeight: 1.5 }}>
              These are the same Hirebase filters used on the backend — adjust city, state, country, work arrangement, and more, then Apply.
              Match preferences (top) control remote/relocation scope on the default feed.
            </p>
            <JobFiltersGrid form={form} setForm={setForm} toggleSet={toggleSet} trackedCompanyNames={trackedCompanyNames} />
          </>
        )}

        <ActiveFiltersBar labels={activeFilterLabels} onClear={hasSearchFilters ? clearSearchFilters : undefined} />

        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{error}</p>
        )}
        {notice && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45, background: surface.inset, padding: "10px 12px", border: border.line }}>
            {notice}
          </p>
        )}
        {hasActiveSearch && !error && hasLoadedOnce && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Custom filters run a live Hirebase search — results may differ from your daily snapshot.
          </p>
        )}
        {revalidating && jobs.length > 0 && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Updating recommendations…
          </p>
        )}
        {(loading || revalidating) && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45, background: surface.inset, padding: "10px 12px", border: border.line }}>
            {jobs.length > 0
              ? "Still loading — you can switch tabs; results update here when ready."
              : "Loading recommendations — feel free to leave and come back. Results save automatically for this session."}
          </p>
        )}
      </ScoutBox>

      {showInitialSkeleton && (
        <RecommendedLoadingSkeleton />
      )}

      {!showInitialSkeleton && (
        <RecommendedResultsList
          listings={filteredListings}
          savingKey={savingKey}
          onOpenRecommended={onOpenJob}
          onSaveJob={onSaveJob}
          setSavingKey={setSavingKey}
          emptyMessage={emptyMessage}
        />
      )}
    </div>
  );
}
