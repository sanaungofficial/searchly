"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function scoreColor(score: number): string {
  if (score >= 75) return "#2A6B4A";
  if (score >= 55) return "#6B5A2A";
  return "#8A6B4A";
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

function formToFilters(form: ReturnType<typeof filtersToForm>, page: number): VectorSearchFilters {
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

const SEMANTIC_QUERY_STORAGE_KEY = "kimchi_pipeline_semantic_query";

function loadStoredSemanticQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SEMANTIC_QUERY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
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
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: T.caption, color: color.ink, lineHeight: 1.5 }}>
                  {job.matchReasons.slice(0, 2).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
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
  const [showFilters, setShowFilters] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [recommendedJobs, setRecommendedJobs] = useState<VectorMatchedJob[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);

  const [searchJobs, setSearchJobs] = useState<VectorMatchedJob[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchScoped, setSearchScoped] = useState(true);

  const savedUrls = useMemo(() => {
    const set = new Set<string>();
    for (const card of pipelineCards) {
      const url = (card as KanbanCard & { _url?: string })._url;
      const norm = normalizeJobUrl(url);
      if (norm) set.add(norm);
    }
    return set;
  }, [pipelineCards]);

  const loadRecommended = useCallback(async () => {
    setRecommendedLoading(true);
    setRecommendedError(null);
    try {
      const res = await fetch("/api/jobs/recommended");
      const data = (await res.json()) as JobsApiResponse;
      if (!res.ok) {
        setRecommendedError(formatApiErrorMessage(data.error, "Could not load recommended jobs."));
        setRecommendedJobs([]);
      } else {
        setRecommendedJobs(data.jobs ?? []);
      }
    } catch {
      setRecommendedError("Network error — try again.");
      setRecommendedJobs([]);
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

  const runKeywordSearch = useCallback(async (filtersForm = form) => {
    const semanticQuery = filtersForm.semanticQuery.trim();
    if (!semanticQuery) {
      setSearchError("Enter keywords to search.");
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    try {
      localStorage.setItem(SEMANTIC_QUERY_STORAGE_KEY, semanticQuery);
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch("/api/jobs/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToFilters(filtersForm, 1)),
      });
      const data = (await res.json()) as JobsApiResponse;
      if (!res.ok) {
        setSearchError(formatApiErrorMessage(data.error, "Search failed."));
        setSearchJobs([]);
      } else {
        setSearchJobs(data.jobs ?? []);
        setSearchScoped(data.matchMode !== "semantic_global");
      }
      setHasSearched(true);
    } catch {
      setSearchError("Network error — try again.");
      setSearchJobs([]);
    } finally {
      setSearchLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadRecommended();
  }, [loadRecommended]);

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div>
      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <ScoutLabel>Recommended for you</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              Matching roles at your tracked companies — same results as Companies → Matching roles. Does not use resume embed.
            </p>
          </div>
          <ScoutSecondaryBtn onClick={loadRecommended} disabled={recommendedLoading}>
            {recommendedLoading ? "Loading…" : "Refresh"}
          </ScoutSecondaryBtn>
        </div>
        {recommendedError && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{recommendedError}</p>
        )}
      </ScoutBox>

      {recommendedLoading && (
        <ScoutBox style={{ padding: 40, textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>Loading matching roles from your companies…</p>
        </ScoutBox>
      )}

      {!recommendedLoading && (
        <div style={{ marginBottom: 32 }}>
          <JobResultsList
            jobs={recommendedJobs}
            savedUrls={savedUrls}
            savingKey={savingKey}
            onOpenJob={onOpenJob}
            onSaveJob={onSaveJob}
            setSavingKey={setSavingKey}
            emptyMessage={
              recommendedError
                ? "Fix the issue above, then refresh."
                : "No matching roles yet — track companies and refresh matching roles on the Companies page."
            }
          />
        </div>
      )}

      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoutLabel>Search jobs</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              Keyword search across your tracked companies (not resume-based). Add filters to narrow results.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <ScoutSecondaryBtn onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide filters" : "Filters"}
            </ScoutSecondaryBtn>
            <ScoutPrimaryBtn onClick={() => runKeywordSearch()} disabled={searchLoading}>
              {searchLoading ? "Searching…" : "Search"}
            </ScoutPrimaryBtn>
          </div>
        </div>

        <FilterField label="Search keywords">
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.5 }}
            value={form.semanticQuery}
            onChange={(e) => setForm((f) => ({ ...f, semanticQuery: e.target.value }))}
            placeholder="e.g. remote corporate strategy, B2B SaaS, healthcare"
            maxLength={400}
          />
        </FilterField>

        {showFilters && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 16px", marginTop: 8, paddingTop: 16, borderTop: border.line }}>
            <FilterField label="Job titles">
              <input style={inputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="Product Manager, Engineer" />
            </FilterField>
            <FilterField label="Keywords">
              <input style={inputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="Python, B2B SaaS" />
            </FilterField>
            <FilterField label="City">
              <input style={inputStyle} value={form.locationCity} onChange={(e) => setForm((f) => ({ ...f, locationCity: e.target.value }))} />
            </FilterField>
            <FilterField label="State / region">
              <input style={inputStyle} value={form.locationRegion} onChange={(e) => setForm((f) => ({ ...f, locationRegion: e.target.value }))} />
            </FilterField>
            <FilterField label="Country">
              <input style={inputStyle} value={form.locationCountry} onChange={(e) => setForm((f) => ({ ...f, locationCountry: e.target.value }))} />
            </FilterField>
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
              <FilterField label="Company size">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {HIREBASE_COMPANY_SIZE_BUCKETS.map((t) => (
                    <ChipToggle key={t} label={t} active={form.companySizeBuckets.has(t)} onClick={() => setForm((f) => ({ ...f, companySizeBuckets: toggleSet(f.companySizeBuckets, t) }))} />
                  ))}
                </div>
              </FilterField>
            </div>
          </div>
        )}

        {searchError && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 12, lineHeight: 1.45 }}>{searchError}</p>
        )}
        {hasSearched && !searchError && searchScoped && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Results are limited to your tracked companies.
          </p>
        )}
      </ScoutBox>

      {searchLoading && (
        <ScoutBox style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>Searching…</p>
        </ScoutBox>
      )}

      {hasSearched && !searchLoading && (
        <JobResultsList
          jobs={searchJobs}
          savedUrls={savedUrls}
          savingKey={savingKey}
          onOpenJob={onOpenJob}
          onSaveJob={onSaveJob}
          setSavingKey={setSavingKey}
          emptyMessage="No jobs matched — try different keywords or track more companies."
        />
      )}
    </div>
  );
}
