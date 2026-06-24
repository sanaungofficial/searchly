"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import type { KanbanCard } from "./workspace-data";
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
import { cachedJobToMeta, normalizeJobUrl } from "@/lib/cached-job";
import {
  filtersCacheKey,
  isCacheFresh,
  readRecommendedCache,
  writeRecommendedCache,
} from "@/lib/recommended-jobs-cache";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";

type JobsApiResponse = {
  jobs?: VectorMatchedJob[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  matchMode?: string;
  error?: string;
};

const SEMANTIC_QUERY_STORAGE_KEY = "kimchi_pipeline_semantic_query";

const COMMON_COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "India", "Singapore"];

const US_STATES = [
  "California", "New York", "Texas", "Washington", "Massachusetts", "Illinois", "Colorado", "Georgia", "Florida", "Virginia",
];

function scoreColor(score: number): string {
  if (score >= 75) return "#2A6B4A";
  if (score >= 55) return "#6B5A2A";
  return "#8A6B4A";
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
  const reasons = job.matchReasons.filter(Boolean).slice(0, 3);
  if (!reasons.length) return null;

  const matchedSkills = job.matchedSkills?.slice(0, 6) ?? [];

  return (
    <div
      style={{
        marginTop: 14,
        padding: "14px 16px",
        background: "rgba(26,58,47,0.06)",
        border: "1px solid rgba(26,58,47,0.12)",
        borderLeft: `3px solid ${color.forest}`,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.forest,
          margin: "0 0 4px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        Why you&apos;re a good fit
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: scoreColor(job.matchScore) }}>{job.matchLabel}</span>
        {" "}match · {job.matchScore}/100 based on your profile
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {reasons.map((reason) => (
          <li
            key={reason}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.ink,
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 6,
                height: 6,
                marginTop: 7,
                borderRadius: "50%",
                background: color.forest,
              }}
            />
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      {matchedSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {matchedSkills.map((skill) => (
            <span
              key={skill}
              style={{
                padding: "4px 10px",
                background: "rgba(26,58,47,0.08)",
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 500,
                color: color.forest,
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

function JobResultsList({
  jobs,
  savedUrls,
  savingKey,
  onOpenJob,
  onSaveJob,
  setSavingKey,
  emptyMessage,
}: {
  jobs: VectorMatchedJob[];
  savedUrls: Set<string>;
  savingKey: string | null;
  onOpenJob: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
  setSavingKey: (key: string | null) => void;
  emptyMessage: string;
}) {
  const visibleJobs = jobs.filter((job) => {
    const norm = normalizeJobUrl(job.url);
    return !norm || !savedUrls.has(norm);
  });

  if (!visibleJobs.length) {
    return (
      <ScoutBox style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>{emptyMessage}</p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {visibleJobs.map((job) => {
        const key = job.hirebaseId ?? job.url ?? `${job.companyName}-${job.title}`;
        return (
          <ScoutBox key={key} padding={18}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenJob(job)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenJob(job);
                }
              }}
              style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
            >
              <CompanyLogo name={job.companyName} website={job.url} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.title}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                      {job.companyName}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 700, color: scoreColor(job.matchScore) }}>
                      {job.matchScore}
                    </div>
                    <div style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>{job.matchLabel}</div>
                  </div>
                </div>
                <MatchFitCallout job={job} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap" }}>
              <ScoutPrimaryBtn
                onClick={(e) => {
                  e.stopPropagation();
                  setSavingKey(key);
                  onSaveJob(job).finally(() => setSavingKey(null));
                }}
                disabled={savingKey === key}
              >
                {savingKey === key ? "Saving…" : "Save to pipeline"}
              </ScoutPrimaryBtn>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
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
}: {
  pipelineCards: KanbanCard[];
  onOpenJob: (job: VectorMatchedJob) => void;
  onSaveJob: (job: VectorMatchedJob) => Promise<void>;
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

  const savedUrls = useMemo(() => {
    const set = new Set<string>();
    for (const card of pipelineCards) {
      const url = (card as KanbanCard & { _url?: string })._url;
      const norm = normalizeJobUrl(url);
      if (norm) set.add(norm);
    }
    return set;
  }, [pipelineCards]);

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
          setError(msg);
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
          setSearchScoped(data.matchMode !== "semantic_global");
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

  const showInitialSkeleton = loading && !jobs.length && !hasLoadedOnce;
  const showEmptyState = hasLoadedOnce && !loading && !jobs.length;

  const emptyMessage = error
    ? "Fix the issue above, then refresh."
    : hasActiveSearch
      ? "No jobs matched your search — try different keywords or track more companies."
      : "No roles match these filters — try broadening filters or refresh matching roles on Companies.";

  return (
    <div>
      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoutLabel>Recommended for you</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              Matching roles at your tracked companies. Search or filter to narrow the list.
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
            Results are limited to your tracked companies.
          </p>
        )}
        {revalidating && jobs.length > 0 && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Updating recommendations…
          </p>
        )}
      </ScoutBox>

      {showInitialSkeleton && (
        <RecommendedLoadingSkeleton message="Finding matching roles at your companies — give it a second…" />
      )}

      {!showInitialSkeleton && (
        <>
          {showEmptyState ? (
            <JobResultsList
              jobs={[]}
              savedUrls={savedUrls}
              savingKey={savingKey}
              onOpenJob={onOpenJob}
              onSaveJob={onSaveJob}
              setSavingKey={setSavingKey}
              emptyMessage={emptyMessage}
            />
          ) : (
            jobs.length > 0 && (
              <JobResultsList
                jobs={jobs}
                savedUrls={savedUrls}
                savingKey={savingKey}
                onOpenJob={onOpenJob}
                onSaveJob={onSaveJob}
                setSavingKey={setSavingKey}
                emptyMessage={emptyMessage}
              />
            )
          )}
        </>
      )}
    </div>
  );
}
