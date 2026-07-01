"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { networkAgencyDisplayName, previewPlainText, SEED_NETWORK_JOBS } from "@/lib/network-job-display";
import { networkExecThreadRecruitingFirmLabel } from "@/lib/network-employer-labels";
import type { NetworkMatchedJob } from "@/lib/network-job-match";
import { sortNetworkMatchedJobs } from "@/lib/network-job-match";
import { canViewNetworkJobInternal } from "@/lib/network-job-access";
import {
  NETWORK_JOB_CLIENT_BADGE,
  NETWORK_JOB_CLIENT_INTRO,
  networkSourceChannelCode,
  networkSourceListingLinkLabel,
} from "@/lib/network-source-labels";
import {
  networkJobClientApplyUrl,
  networkJobHasRecruiter,
  networkJobPartnerListingUrl,
  networkJobShowSendProfile,
} from "@/lib/network-job-client-actions";
import {
  createEmptyNetworkJobFilterForm,
  buildNetworkJobFilterSuggestions,
  countActiveNetworkFilterFields,
  networkJobFilterSearchParams,
  type NetworkJobFilterForm,
} from "@/lib/network-job-filters";
import { NETWORK_JOBS_PAGE_SIZE } from "@/lib/network-jobs-load";
import { describeNetworkActiveFilters, networkFormFromProfileDefaults } from "@/lib/network-profile-defaults";
import { locationFieldsFromProfileString } from "@/lib/recommended-filter-utils";
import { loadScopedNetworkSearch, saveScopedNetworkSearch } from "@/lib/client-session";
import {
  clearNetworkJobsCache,
  defaultNetworkCacheEntry,
  readNetworkJobsCache,
  writeNetworkJobsCache,
} from "@/lib/network-jobs-cache";
import { CompanyLogo } from "./company-logo";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import {
  CircularMatchScore,
  filterMatchReasons,
  MatchScoreColumn,
  MatchWhyScorePopover,
  matchScorePanelBackground,
} from "./match-why-score-ui";
import { NetworkJobRequestModal, type NetworkJobRequestModalKind } from "./network-job-request-modal";
import { NetworkFiltersDrawer, NetworkQuickFiltersBar } from "./pipeline-network-filters";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveFiltersBar, pipelineInputStyle, ProfileSuggestionsBanner } from "./pipeline-filters-ui";

const EMPTY_MATCH = {
  matchScore: 0,
  matchLabel: "",
  matchReasons: [] as string[],
  matchedSkills: [] as string[],
  gapSkills: [] as string[],
};

function seedAsMatched(jobs: NetworkJobListing[]): NetworkMatchedJob[] {
  return jobs.map((job) => ({ ...job, ...EMPTY_MATCH }));
}

interface PipelineNetworkSectionProps {
  onOpenJob: (job: NetworkJobListing) => void;
  onSaveJob?: (job: NetworkJobListing) => Promise<void>;
  actingUserId?: string | null;
  embedded?: boolean;
}

function NetworkJobMetadataGrid({ job }: { job: NetworkMatchedJob }) {
  const items: string[] = [];
  if (job.location) items.push(job.location);
  if (job.jobType) items.push(job.jobType);
  if (job.remoteOption) items.push(job.remoteOption);
  if (job.salary) items.push(job.salary);
  if (!items.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 18px", marginTop: 10 }}>
      {items.map((label) => (
        <span
          key={label}
          style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, whiteSpace: "nowrap" }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function NetworkMatchScoreStacked({
  score,
  label,
  reasons,
  matchedSkills,
}: {
  score: number;
  label: string;
  reasons: string[];
  matchedSkills: string[];
}) {
  const filteredReasons = filterMatchReasons(reasons);
  const skills = matchedSkills.slice(0, 6);
  const panelBg = matchScorePanelBackground(score);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        background: panelBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 18px",
        borderTop: "1.5px solid rgba(255,255,255,0.07)",
      }}
    >
      <MatchWhyScorePopover reasons={filteredReasons} matchedSkills={skills}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <CircularMatchScore score={score} />
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 10,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {label} Match
          </p>
        </div>
      </MatchWhyScorePopover>
    </div>
  );
}

function NetworkJobCard({
  job,
  internalView,
  onOpen,
  onSave,
  onRequestAction,
  saving,
  isMobile,
}: {
  job: NetworkMatchedJob;
  internalView: boolean;
  onOpen: () => void;
  onSave?: () => void;
  onRequestAction?: (kind: NetworkJobRequestModalKind) => void;
  saving?: boolean;
  isMobile: boolean;
}) {
  const company = networkAgencyDisplayName(job);
  const recruitingFirm = job.source === "EXECTHREAD" ? networkExecThreadRecruitingFirmLabel(job) : job.agencyName;
  const hasAgencyLogo = Boolean(job.agencyLogoUrl?.trim());
  const summary = previewPlainText(job.description);
  const shareLabel = job.sharedAt
    ? job.sharedAtRelative
      ? `Shared ${job.sharedAtLabel} · ${job.sharedAtRelative}`
      : `Shared ${job.sharedAtLabel}`
    : null;
  const clientApplyUrl = networkJobClientApplyUrl(job, internalView);
  const partnerListingUrl = networkJobPartnerListingUrl(job, internalView);
  const showIntro = !internalView && networkJobHasRecruiter(job);
  const showSendProfile = networkJobShowSendProfile(job, internalView);
  const matchScore = job.matchScore ?? 0;
  const showMatch = matchScore > 0 && Boolean(job.matchLabel);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile && showMatch ? "column" : "row",
        border: "1.5px solid #161616",
        borderRadius: 8,
        background: surface.card,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          style={{ flex: 1, padding: 18, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span
              style={{
                padding: "2px 8px",
                background: "rgba(196,168,106,0.15)",
                border: "1px solid rgba(196,168,106,0.35)",
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#6B5A2A",
              }}
            >
              {NETWORK_JOB_CLIENT_BADGE}
            </span>
            <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontMono, fontSize: T.label, fontWeight: 700, color: color.forest }}>
              {networkSourceChannelCode(job.source)}
            </span>
            {internalView && job.networkStatusLabel && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.forest }}>
                {job.networkStatusLabel}
              </span>
            )}
            {internalView && job.networkId && (
              <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>{job.networkId}</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <CompanyLogo
              name={company}
              logoUrl={hasAgencyLogo ? job.agencyLogoUrl : null}
              website={hasAgencyLogo ? job.agencyWebsite : null}
              skipDomainLookup
              size={48}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.positionTitle}</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{company}</p>
              {shareLabel && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "6px 0 0" }}>{shareLabel}</p>
              )}
              <NetworkJobMetadataGrid job={job} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: summary ? 10 : 8 }}>
                {job.industries.map((industry) => (
                  <span key={industry} style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    {industry}
                  </span>
                ))}
                {recruitingFirm && (
                  <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    {recruitingFirm}
                  </span>
                )}
                {internalView && job.fee && (
                  <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    Fee: {job.fee}
                  </span>
                )}
                {internalView && job.guaranteeLabel && (
                  <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    Guarantee: {job.guaranteeLabel}
                  </span>
                )}
              </div>
              {summary && (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55, margin: "10px 0 0" }}>
                  {summary}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          style={{ display: "flex", gap: 8, padding: "0 18px 16px", flexWrap: "wrap", alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onSave && (
            <ScoutPrimaryBtn onClick={() => onSave()} disabled={saving}>
              {saving ? "Saving…" : "Save job"}
            </ScoutPrimaryBtn>
          )}
          {showIntro && onRequestAction && (
            <ScoutSecondaryBtn onClick={() => onRequestAction("intro")}>Request introduction</ScoutSecondaryBtn>
          )}
          {showSendProfile && onRequestAction && (
            <ScoutSecondaryBtn onClick={() => onRequestAction("send-profile")}>Send your profile</ScoutSecondaryBtn>
          )}
          {clientApplyUrl && (
            <a
              href={clientApplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
            >
              Apply ↗
            </a>
          )}
          {partnerListingUrl && (
            <a
              href={partnerListingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
            >
              {networkSourceListingLinkLabel(job.source)}
            </a>
          )}
        </div>
      </div>

      {showMatch &&
        (isMobile ? (
          <NetworkMatchScoreStacked
            score={matchScore}
            label={job.matchLabel}
            reasons={job.matchReasons ?? []}
            matchedSkills={job.matchedSkills ?? []}
          />
        ) : (
          <MatchScoreColumn
            score={matchScore}
            label={job.matchLabel}
            reasons={job.matchReasons ?? []}
            matchedSkills={job.matchedSkills ?? []}
          />
        ))}
    </div>
  );
}

export function PipelineNetworkSection({ onOpenJob, onSaveJob, actingUserId, embedded }: PipelineNetworkSectionProps) {
  const { isAdmin, userRole, isImpersonating, withClientScope } = useWorkspace();
  const isMobile = useIsMobile();
  const internalView = canViewNetworkJobInternal(userRole, isAdmin, isImpersonating);

  const [jobs, setJobs] = useState<NetworkMatchedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileHint, setProfileHint] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<{ job: NetworkMatchedJob; kind: NetworkJobRequestModalKind } | null>(null);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [form, setForm] = useState<NetworkJobFilterForm>(() => ({
    ...createEmptyNetworkJobFilterForm(),
    search: loadScopedNetworkSearch(),
  }));
  const [appliedForm, setAppliedForm] = useState<NetworkJobFilterForm>(() => createEmptyNetworkJobFilterForm());
  const [profileSuggestedLabels, setProfileSuggestedLabels] = useState<string[]>([]);
  const profileFormRef = useRef<NetworkJobFilterForm | null>(null);
  const mountedRef = useRef(false);
  const prevActingUserIdRef = useRef<string | null | undefined>(undefined);

  const emptyFilterForm = useCallback(
    (): NetworkJobFilterForm => ({
      ...createEmptyNetworkJobFilterForm(),
      search: loadScopedNetworkSearch(),
    }),
    [],
  );

  type FetchPageResult = {
    jobs: NetworkMatchedJob[];
    total: number;
    hasMore: boolean;
    page: number;
    needsProfile: boolean;
    hint: string | null;
  };

  const persistNetworkCache = useCallback(
    (
      result: FetchPageResult,
      filters: NetworkJobFilterForm,
      extras?: { profileSuggestedLabels?: string[]; profileForm?: NetworkJobFilterForm | null },
    ) => {
      writeNetworkJobsCache(
        defaultNetworkCacheEntry({
          jobs: result.jobs,
          appliedForm: filters,
          total: result.total,
          hasMore: result.hasMore,
          page: result.page,
          needsProfile: result.needsProfile,
          hint: result.hint,
          profileSuggestedLabels: extras?.profileSuggestedLabels ?? profileSuggestedLabels,
          profileForm: extras?.profileForm ?? profileFormRef.current ?? undefined,
        }),
      );
    },
    [profileSuggestedLabels],
  );

  const fetchPage = useCallback(
    async (
      pageNum: number,
      filters: NetworkJobFilterForm,
      append: boolean,
      existingJobs: NetworkMatchedJob[] = [],
    ): Promise<FetchPageResult | null> => {
      const params = networkJobFilterSearchParams(filters, pageNum, NETWORK_JOBS_PAGE_SIZE);
      const res = await fetch(withClientScope(`/api/network-jobs/match?${params.toString()}`));
      const data = (await res.json()) as {
        jobs?: NetworkMatchedJob[];
        needsProfile?: boolean;
        hint?: string;
        total?: number;
        hasMore?: boolean;
      };
      if (res.ok && Array.isArray(data.jobs)) {
        const nextJobs = append ? sortNetworkMatchedJobs([...existingJobs, ...data.jobs]) : data.jobs;
        const nextTotal = data.total ?? data.jobs.length;
        const nextHasMore = Boolean(data.hasMore);
        const nextNeedsProfile = Boolean(data.needsProfile);
        const nextHint = data.hint ?? null;
        setJobs(nextJobs);
        setTotal(nextTotal);
        setHasMore(nextHasMore);
        setPage(pageNum);
        setNeedsProfile(nextNeedsProfile);
        setProfileHint(nextHint);
        return {
          jobs: nextJobs,
          total: nextTotal,
          hasMore: nextHasMore,
          page: pageNum,
          needsProfile: nextNeedsProfile,
          hint: nextHint,
        };
      }
      if (!append) {
        setJobs([]);
        setTotal(0);
        setHasMore(false);
      }
      return null;
    },
    [withClientScope],
  );

  const loadProfileSuggestions = useCallback(async () => {
    try {
      const [defaultsData, profileData] = await Promise.all([
        fetch(withClientScope("/api/jobs/recommended/defaults")).then((res) => (res.ok ? res.json() : null)),
        fetch(withClientScope("/api/profile")).then((res) => (res.ok ? res.json() : null)),
      ] as const);

      const targetRoles = Array.isArray(profileData?.targetRoles) ? profileData.targetRoles : [];

      let profileForm: NetworkJobFilterForm;
      if (defaultsData?.filters) {
        profileForm = networkFormFromProfileDefaults(defaultsData.filters, targetRoles);
      } else {
        const fields = locationFieldsFromProfileString(profileData?.parsedData?.location);
        profileForm = {
          ...createEmptyNetworkJobFilterForm(),
          jobTitles: targetRoles.join(", "),
          locationCity: fields.city,
          locationState: fields.region,
        };
      }
      profileForm.search = loadScopedNetworkSearch();
      profileFormRef.current = profileForm;
      const labels = defaultsData?.labels?.length ? defaultsData.labels : describeNetworkActiveFilters(profileForm);
      setProfileSuggestedLabels(labels);
      return { labels, profileForm };
    } catch {
      profileFormRef.current = null;
      setProfileSuggestedLabels([]);
      return { labels: [] as string[], profileForm: null as NetworkJobFilterForm | null };
    }
  }, [withClientScope]);

  const loadJobs = useCallback(
    async (filters: NetworkJobFilterForm = createEmptyNetworkJobFilterForm()) => {
      setLoading(true);
      try {
        const [result, profile] = await Promise.all([fetchPage(1, filters, false), loadProfileSuggestions()]);
        if (result) {
          persistNetworkCache(result, filters, {
            profileSuggestedLabels: profile.labels,
            profileForm: profile.profileForm,
          });
        }
      } catch {
        setJobs(seedAsMatched(SEED_NETWORK_JOBS));
        setTotal(SEED_NETWORK_JOBS.length);
        setHasMore(false);
        setNeedsProfile(false);
        setProfileHint(null);
      } finally {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    },
    [fetchPage, loadProfileSuggestions, persistNetworkCache],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPage(page + 1, appliedForm, true, jobs);
      if (result) {
        persistNetworkCache(result, appliedForm);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [appliedForm, fetchPage, hasMore, jobs, loadingMore, page, persistNetworkCache]);

  useEffect(() => {
    const prev = prevActingUserIdRef.current;
    prevActingUserIdRef.current = actingUserId ?? null;
    if (prev === undefined) return;

    mountedRef.current = false;
    clearNetworkJobsCache();
    setAppliedForm(createEmptyNetworkJobFilterForm());
    setProfileSuggestedLabels([]);
    profileFormRef.current = null;
    setForm(emptyFilterForm());
    setJobs([]);
    setTotal(0);
    setPage(1);
    setHasMore(false);
    setHasLoadedOnce(false);
    setLoading(false);
    setNeedsProfile(false);
    setProfileHint(null);
  }, [actingUserId, emptyFilterForm]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const cached = readNetworkJobsCache();
    if (cached) {
      setJobs(cached.jobs);
      setAppliedForm(cached.appliedForm);
      setForm({ ...cached.appliedForm, search: loadScopedNetworkSearch() });
      setTotal(cached.total);
      setHasMore(cached.hasMore);
      setPage(cached.page);
      setNeedsProfile(Boolean(cached.needsProfile));
      setProfileHint(cached.hint ?? null);
      setProfileSuggestedLabels(cached.profileSuggestedLabels ?? []);
      profileFormRef.current = cached.profileForm ?? null;
      setHasLoadedOnce(true);
      setLoading(false);
      return;
    }

    void loadJobs(createEmptyNetworkJobFilterForm());
  }, [actingUserId, loadJobs]);

  const suggestions = useMemo(() => buildNetworkJobFilterSuggestions(jobs), [jobs]);
  const activeFilterCount = countActiveNetworkFilterFields(appliedForm, internalView);
  const hasActiveFilters = activeFilterCount > 0;
  const displayJobs = useMemo(() => sortNetworkMatchedJobs(jobs), [jobs]);
  const activeFilterLabels = useMemo(() => (hasActiveFilters ? describeNetworkActiveFilters(appliedForm) : []), [appliedForm, hasActiveFilters]);
  const hasActiveSearch = Boolean(appliedForm.search.trim());
  const showInitialLoader = loading && !hasLoadedOnce;
  const showRefreshLoader = loading && hasLoadedOnce && jobs.length > 0;

  const applyFilters = (nextForm = form) => {
    saveScopedNetworkSearch(nextForm.search);
    setAppliedForm({ ...nextForm });
    setLoading(true);
    void fetchPage(1, nextForm, false)
      .then((result) => {
        if (result) persistNetworkCache(result, nextForm);
      })
      .finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
  };

  const applyProfileSuggestions = () => {
    const suggested = profileFormRef.current;
    if (!suggested) return;
    const next = { ...suggested, search: form.search };
    setForm(next);
    applyFilters(next);
  };

  const resetFilters = () => {
    saveScopedNetworkSearch("");
    const reset = { ...createEmptyNetworkJobFilterForm(), search: "" };
    setForm(reset);
    setAppliedForm(createEmptyNetworkJobFilterForm());
    setLoading(true);
    void fetchPage(1, createEmptyNetworkJobFilterForm(), false)
      .then((result) => {
        if (result) persistNetworkCache(result, createEmptyNetworkJobFilterForm());
      })
      .finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
  };

  const inputStyle = { ...pipelineInputStyle, margin: 0 };

  return (
    <div style={{ padding: embedded ? 0 : isMobile ? "20px 16px 32px" : "32px 36px 48px" }}>
      {!embedded && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, background: "#C4A86A", display: "inline-block", flexShrink: 0 }} />
            <ScoutLabel>Premium recruiter network{internalView ? " · internal" : ""}</ScoutLabel>
          </div>
          <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>In-Network Roles</ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
            {internalView ? "Staff view — internal fee and channel details stay in the drawer. Clients see recruiter-network roles ranked by profile fit." : NETWORK_JOB_CLIENT_INTRO}
          </p>
        </div>
      )}

      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <ScoutLabel>In-Network Roles</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              {internalView ? "Staff view — partner fees and channel tags live in the drawer." : "Search and filter roles recruiters are actively filling — ranked by fit with your profile."}
            </p>
            {hasLoadedOnce && !showInitialLoader && total > 0 && (
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight, margin: "6px 0 0" }}>
                {hasActiveFilters
                  ? `${displayJobs.length.toLocaleString()} of ${total.toLocaleString()} matching role${total === 1 ? "" : "s"}`
                  : `${displayJobs.length.toLocaleString()} of ${total.toLocaleString()} recruiter-network role${total === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
          <ScoutSecondaryBtn onClick={() => void loadJobs(appliedForm)} disabled={loading || loadingMore} style={{ alignSelf: isMobile ? "flex-start" : "flex-end" }}>
            {loading || loadingMore ? "Loading…" : "Refresh"}
          </ScoutSecondaryBtn>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexDirection: isMobile ? "column" : "row" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.search}
            onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
              }
            }}
            placeholder="Title, keyword, location, or industry"
            aria-label="Search in-network roles"
            maxLength={400}
          />
          <ScoutPrimaryBtn onClick={() => applyFilters()} disabled={loading || loadingMore} style={{ flexShrink: 0, minWidth: isMobile ? undefined : 96 }}>
            {loading && !hasLoadedOnce ? "Loading…" : "Search"}
          </ScoutPrimaryBtn>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: border.line }}>
          <NetworkQuickFiltersBar
            form={form}
            setForm={setForm}
            suggestions={suggestions}
            internalView={internalView}
            onQuickApply={(nextForm) => applyFilters(nextForm)}
            onOpenAllFilters={() => setFiltersDrawerOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {profileSuggestedLabels.length > 0 && !hasActiveFilters && (
          <ProfileSuggestionsBanner labels={profileSuggestedLabels} onApply={applyProfileSuggestions} hint="Not applied automatically — click Apply & search to filter using your profile preferences, then adjust as needed." />
        )}

        <NetworkFiltersDrawer
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          form={form}
          setForm={setForm}
          suggestions={suggestions}
          internalView={internalView}
          applying={loading || loadingMore}
          onApply={() => {
            applyFilters();
            setFiltersDrawerOpen(false);
          }}
          onReset={() => setForm({ ...createEmptyNetworkJobFilterForm(), search: form.search })}
        />

        <ActiveFiltersBar labels={activeFilterLabels} onClear={hasActiveFilters ? resetFilters : undefined} />

        {needsProfile && profileHint && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45, background: surface.inset, padding: "10px 12px", border: border.line }}>{profileHint}</p>
        )}

        {hasActiveFilters && !loading && displayJobs.length === 0 && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45, background: surface.inset, padding: "10px 12px", border: border.line }}>
            Nothing matched your filters. Clear filters or broaden your search.
          </p>
        )}

        {hasActiveSearch && hasLoadedOnce && !showInitialLoader && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            Search runs across title, company, location, and description.
          </p>
        )}
      </ScoutBox>

      {showInitialLoader ? (
        <KimchiProcessLoader preset="recommendations" variant="inline" fullWidth title="Loading in-network roles…" />
      ) : !hasLoadedOnce ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0, lineHeight: 1.55 }}>
            Click Refresh to load in-network roles from the recruiter network.
          </p>
        </ScoutBox>
      ) : jobs.length === 0 ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
            No network roles matched — try clearing filters or check back soon.
          </p>
        </ScoutBox>
      ) : (
        <>
          {showRefreshLoader && (
            <div style={{ marginBottom: 12 }}>
              <KimchiProcessLoader preset="recommendations" variant="inline" fullWidth title="Updating results…" />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayJobs.map((job) => (
              <NetworkJobCard
                key={`${job.source}-${job.id}`}
                job={job}
                internalView={internalView}
                isMobile={isMobile}
                onOpen={() => onOpenJob(job)}
                onSave={
                  onSaveJob
                    ? () => {
                        setSavingId(job.id);
                        onSaveJob(job).finally(() => setSavingId(null));
                      }
                    : undefined
                }
                onRequestAction={
                  !internalView && (networkJobHasRecruiter(job) || networkJobShowSendProfile(job, internalView))
                    ? (kind) => setRequestModal({ job, kind })
                    : undefined
                }
                saving={savingId === job.id}
              />
            ))}
            {hasMore && (
              <ScoutBox style={{ padding: "20px 24px", textAlign: "center" }}>
                <ScoutSecondaryBtn onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? "Loading more…" : `Load more (${(total - displayJobs.length).toLocaleString()} remaining)`}
                </ScoutSecondaryBtn>
              </ScoutBox>
            )}
          </div>
        </>
      )}

      {requestModal && (
        <NetworkJobRequestModal
          kind={requestModal.kind}
          jobId={requestModal.job.id}
          jobTitle={requestModal.job.positionTitle}
          companyLabel={networkAgencyDisplayName(requestModal.job)}
          recruiterName={requestModal.job.recruiter?.name ?? requestModal.job.recruiters?.[0]?.name}
          open
          onClose={() => setRequestModal(null)}
        />
      )}
    </div>
  );
}
