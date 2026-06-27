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
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { locationFieldsFromProfileString } from "@/lib/recommended-filter-utils";
import { loadScopedNetworkSearch, saveScopedNetworkSearch } from "@/lib/client-session";
import { writeNetworkJobsCache } from "@/lib/network-jobs-cache";
import { CompanyLogo } from "./company-logo";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { MatchFitCallout, MatchScoreBadge, ScoreSourceHint } from "./match-score-ui";
import { ScoreExplainerPopover } from "./score-explainer-popover";
import { NetworkJobRequestModal, type NetworkJobRequestModalKind } from "./network-job-request-modal";
import { NetworkFiltersDrawer, NetworkQuickFiltersBar } from "./pipeline-network-filters";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveFiltersBar, FilterField, pipelineInputStyle, ProfileSuggestionsBanner } from "./pipeline-filters-ui";

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

function NetworkJobCard({
  job,
  internalView,
  onOpen,
  onSave,
  onRequestAction,
  saving,
}: {
  job: NetworkMatchedJob;
  internalView: boolean;
  onOpen: () => void;
  onSave?: () => void;
  onRequestAction?: (kind: NetworkJobRequestModalKind) => void;
  saving?: boolean;
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

  return (
    <ScoutBox padding={18}>
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
        style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
      >
        <CompanyLogo name={company} logoUrl={hasAgencyLogo ? job.agencyLogoUrl : null} website={hasAgencyLogo ? job.agencyWebsite : null} skipDomainLookup size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ padding: "2px 8px", background: "rgba(196,168,106,0.15)", border: "1px solid rgba(196,168,106,0.35)", fontFamily: fontSans, fontSize: T.label, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B5A2A" }}>
                  {NETWORK_JOB_CLIENT_BADGE}
                </span>
                <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontMono, fontSize: T.label, fontWeight: 700, color: color.forest }}>
                  {networkSourceChannelCode(job.source)}
                </span>
                {internalView && job.networkStatusLabel && (
                  <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.forest }}>{job.networkStatusLabel}</span>
                )}
                {internalView && job.networkId && (
                  <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>{job.networkId}</span>
                )}
              </div>
              <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.positionTitle}</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
                {company}
                {job.location ? ` · ${job.location}` : ""}
              </p>
              {shareLabel && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 8px" }}>{shareLabel}</p>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: summary ? 10 : 0 }}>
                {job.industries.map((industry) => (
                  <span key={industry} style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>{industry}</span>
                ))}
                {recruitingFirm && <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>{recruitingFirm}</span>}
                {job.jobType && <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>{job.jobType}</span>}
                {job.remoteOption && <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>{job.remoteOption}</span>}
                {job.salary && <span style={{ padding: "2px 8px", border: "1px solid rgba(26,58,47,0.22)", background: "rgba(26,58,47,0.05)", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>{job.salary}</span>}
                {internalView && job.fee && <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>Fee: {job.fee}</span>}
                {internalView && job.guaranteeLabel && <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>Guarantee: {job.guaranteeLabel}</span>}
              </div>
              {summary && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55, margin: 0 }}>{summary}</p>}
            </div>
            {job.matchScore != null && job.matchScore > 0 && job.matchLabel && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <ScoreExplainerPopover variant="network-match" align="right" />
                <MatchScoreBadge score={job.matchScore} label={job.matchLabel} />
                <ScoreSourceHint />
              </div>
            )}
          </div>
          {job.matchScore != null && job.matchScore > 0 && <MatchFitCallout job={job} />}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap", alignItems: "center" }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
          <a href={clientApplyUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}>
            Apply ↗
          </a>
        )}
        {partnerListingUrl && (
          <a href={partnerListingUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}>
            {networkSourceListingLinkLabel(job.source)}
          </a>
        )}
      </div>
    </ScoutBox>
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
  const [loading, setLoading] = useState(true);
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

  const emptyFilterForm = useCallback(
    (): NetworkJobFilterForm => ({
      ...createEmptyNetworkJobFilterForm(),
      search: loadScopedNetworkSearch(),
    }),
    [],
  );

  const fetchPage = useCallback(
    async (pageNum: number, filters: NetworkJobFilterForm, append: boolean) => {
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
        setJobs((prev) => (append ? sortNetworkMatchedJobs([...prev, ...data.jobs!]) : data.jobs!));
        setTotal(data.total ?? data.jobs.length);
        setHasMore(Boolean(data.hasMore));
        setPage(pageNum);
        setNeedsProfile(Boolean(data.needsProfile));
        setProfileHint(data.hint ?? null);
        if (pageNum === 1) {
          writeNetworkJobsCache({ fetchedAt: Date.now(), needsProfile: data.needsProfile, hint: data.hint ?? null });
        }
      } else if (!append) {
        setJobs([]);
        setTotal(0);
        setHasMore(false);
      }
    },
    [withClientScope],
  );

  const loadJobs = useCallback(
    async (filters: NetworkJobFilterForm = createEmptyNetworkJobFilterForm()) => {
      setLoading(true);
      try {
        await fetchPage(1, filters, false);
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
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, appliedForm, true);
    } finally {
      setLoadingMore(false);
    }
  }, [appliedForm, fetchPage, hasMore, loadingMore, page]);

  useEffect(() => {
    setAppliedForm(createEmptyNetworkJobFilterForm());
    setProfileSuggestedLabels([]);
    profileFormRef.current = null;
    setForm(emptyFilterForm());
    setJobs([]);
    setTotal(0);
    setPage(1);
    setHasMore(false);
    setHasLoadedOnce(false);
    void loadJobs(createEmptyNetworkJobFilterForm());

    void Promise.all([
      fetch(withClientScope("/api/jobs/recommended/defaults")).then((res) => (res.ok ? res.json() : null)),
      fetch(withClientScope("/api/profile")).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([defaultsData, profileData]: [
        { filters?: VectorSearchFilters; labels?: string[] } | null,
        { targetRoles?: string[]; prioritizedRoles?: string[]; parsedData?: { location?: string | null } } | null,
      ]) => {
        const targetRoles = [
          ...(Array.isArray(profileData?.prioritizedRoles) ? profileData.prioritizedRoles : []),
          ...(Array.isArray(profileData?.targetRoles) ? profileData.targetRoles : []),
        ]
          .map((r) => r.trim())
          .filter(Boolean)
          .filter((role, index, all) => all.findIndex((r) => r.toLowerCase() === role.toLowerCase()) === index);

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
        setProfileSuggestedLabels(defaultsData?.labels?.length ? defaultsData.labels : describeNetworkActiveFilters(profileForm));
      })
      .catch(() => {
        profileFormRef.current = null;
        setProfileSuggestedLabels([]);
      });
  }, [actingUserId, emptyFilterForm, loadJobs, withClientScope]);

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
    void fetchPage(1, nextForm, false).finally(() => {
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
    void fetchPage(1, createEmptyNetworkJobFilterForm(), false).finally(() => {
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
