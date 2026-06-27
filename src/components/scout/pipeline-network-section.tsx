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
  createEmptyNetworkJobFilterForm,
  buildNetworkJobFilterSuggestions,
  countActiveNetworkFilterFields,
  filterNetworkJobsFromForm,
  type NetworkJobFilterForm,
  type NetworkJobFilterSuggestions,
} from "@/lib/network-job-filters";
import { describeNetworkActiveFilters, networkFormFromProfileDefaults } from "@/lib/network-profile-defaults";
import { HIREBASE_LOCATION_TYPES, HIREBASE_JOB_TYPES } from "@/lib/vector-matched-job";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { locationFieldsFromProfileString } from "@/lib/recommended-filter-utils";
import {
  loadScopedNetworkSearch,
  saveScopedNetworkSearch,
} from "@/lib/client-session";
import {
  readNetworkJobsCache,
  writeNetworkJobsCache,
} from "@/lib/network-jobs-cache";
import { CompanyLogo } from "./company-logo";
import { MatchFitCallout, MatchScoreBadge, ScoreSourceHint } from "./match-score-ui";
import { ScoreExplainerPopover } from "./score-explainer-popover";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { matchScoreStyle } from "@/lib/match-score";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ActiveFiltersBar,
  ChipToggle,
  DatalistInput,
  FilterField,
  FilterPanelShell,
  FilterSectionHeader,
  pipelineInputStyle,
  ProfileSuggestionsBanner,
} from "./pipeline-filters-ui";

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

function NetworkJobFiltersGrid({
  form,
  setForm,
  suggestions,
  internalView,
}: {
  form: NetworkJobFilterForm;
  setForm: React.Dispatch<React.SetStateAction<NetworkJobFilterForm>>;
  suggestions: NetworkJobFilterSuggestions;
  internalView: boolean;
}) {
  const isMobile = useIsMobile();
  return (
    <FilterPanelShell>
      <FilterSectionHeader
        title="Where & how you want to work"
        hint="Same location and work-arrangement fields as Open Roles — filters the in-network list on this page."
      />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 12, marginBottom: 14 }}>
        <FilterField label="City">
          <DatalistInput
            value={form.locationCity}
            onChange={(locationCity) => setForm((f) => ({ ...f, locationCity }))}
            listId="network-city-suggestions"
            options={suggestions.cities}
            placeholder="Sacramento"
          />
        </FilterField>
        <FilterField label="State / region">
          <DatalistInput
            value={form.locationState}
            onChange={(locationState) => setForm((f) => ({ ...f, locationState }))}
            listId="network-state-suggestions"
            options={suggestions.states}
            placeholder="California"
          />
        </FilterField>
      </div>

      <FilterField label="Work arrangement">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {HIREBASE_LOCATION_TYPES.map((t) => (
            <ChipToggle
              key={t}
              label={t}
              active={form.remoteOption.toLowerCase() === t.toLowerCase()}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  remoteOption: f.remoteOption.toLowerCase() === t.toLowerCase() ? "" : t,
                }))
              }
            />
          ))}
        </div>
      </FilterField>

      <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
        <FilterSectionHeader
          title="Role criteria"
          hint="Titles and keywords — comma-separate multiples. Matches title, company, industry, and description."
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        <FilterField label="Job titles">
          <input style={pipelineInputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="Key Account Manager, Attorney" />
        </FilterField>
        <FilterField label="Keywords">
          <input style={pipelineInputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="remote, SaaS, litigation" />
        </FilterField>
        <FilterField label="Company">
          <DatalistInput
            value={form.companyName}
            onChange={(companyName) => setForm((f) => ({ ...f, companyName }))}
            listId="network-company-suggestions"
            options={suggestions.companies}
            placeholder="Employer or agency name"
          />
        </FilterField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
        <FilterField label="Industries">
          <DatalistInput
            value={form.industries}
            onChange={(industries) => setForm((f) => ({ ...f, industries }))}
            listId="network-industry-suggestions"
            options={suggestions.industries}
            placeholder="Healthcare, Software"
          />
        </FilterField>
        <FilterField label="Compensation from ($)">
          <input type="number" style={pipelineInputStyle} value={form.salaryFrom} onChange={(e) => setForm((f) => ({ ...f, salaryFrom: e.target.value }))} placeholder="100000" />
        </FilterField>
        <FilterField label="Compensation to ($)">
          <input type="number" style={pipelineInputStyle} value={form.salaryTo} onChange={(e) => setForm((f) => ({ ...f, salaryTo: e.target.value }))} placeholder="250000" />
        </FilterField>
      </div>

      <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
        <FilterSectionHeader title="More filters" hint="Employment type, channel, and shared date." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        <FilterField label="Employment type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_JOB_TYPES.slice(0, 4).map((t) => (
              <ChipToggle
                key={t}
                label={t}
                active={form.jobType.toLowerCase() === t.toLowerCase()}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    jobType: f.jobType.toLowerCase() === t.toLowerCase() ? "" : t,
                  }))
                }
              />
            ))}
          </div>
        </FilterField>
        <FilterField label="Shared after">
          <input type="date" style={pipelineInputStyle} value={form.sharedAfter} onChange={(e) => setForm((f) => ({ ...f, sharedAfter: e.target.value }))} />
        </FilterField>
        <FilterField label="Channel">
          <select
            style={pipelineInputStyle}
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="">All channels</option>
            <option value="TE">TE</option>
            <option value="ET">ET</option>
          </select>
        </FilterField>
      </div>

      {internalView && (
        <>
          <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
            <FilterSectionHeader title="Internal only" hint="Staff filters for fees, guarantees, and agency." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
            <FilterField label="Recruiting agency">
              <DatalistInput
                value={form.agencyName}
                onChange={(agencyName) => setForm((f) => ({ ...f, agencyName }))}
                listId="network-agency-suggestions"
                options={suggestions.agencies}
                placeholder="Start typing an agency name…"
              />
            </FilterField>
          <FilterField label="Network status">
            <DatalistInput
              value={form.networkStatus}
              onChange={(networkStatus) => setForm((f) => ({ ...f, networkStatus }))}
              listId="network-status-suggestions"
              options={suggestions.statuses}
              placeholder="Active, On hold"
            />
          </FilterField>
          <FilterField label="Placement fee">
            <input style={pipelineInputStyle} value={form.feeQuery} onChange={(e) => setForm((f) => ({ ...f, feeQuery: e.target.value }))} placeholder="20%, $20000 flat" />
          </FilterField>
          <FilterField label="Fee type">
            <DatalistInput
              value={form.feeType}
              onChange={(feeType) => setForm((f) => ({ ...f, feeType }))}
              listId="network-fee-type-suggestions"
              options={suggestions.feeTypes}
              placeholder="percentage, flat"
            />
          </FilterField>
          <FilterField label="Guarantee">
            <DatalistInput
              value={form.guaranteeQuery}
              onChange={(guaranteeQuery) => setForm((f) => ({ ...f, guaranteeQuery }))}
              listId="network-guarantee-suggestions"
              options={suggestions.guarantees}
              placeholder="90 days"
            />
          </FilterField>
          </div>
        </>
      )}
    </FilterPanelShell>
  );
}

function NetworkJobCard({
  job,
  internalView,
  onOpen,
  onSave,
  saving,
}: {
  job: NetworkMatchedJob;
  internalView: boolean;
  onOpen: () => void;
  onSave?: () => void;
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
  const scoreStyle = job.matchScore && job.matchScore > 0 ? matchScoreStyle(job.matchScore) : null;

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
        <CompanyLogo
          name={company}
          logoUrl={hasAgencyLogo ? job.agencyLogoUrl : null}
          website={hasAgencyLogo ? job.agencyWebsite : null}
          skipDomainLookup
          size={44}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
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
            <span
              style={{
                padding: "2px 8px",
                border: border.line,
                fontFamily: fontMono,
                fontSize: T.label,
                fontWeight: 700,
                color: color.forest,
              }}
            >
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

              <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.positionTitle}</p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
                {company}
                {job.location ? ` · ${job.location}` : ""}
              </p>
              {shareLabel && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 8px" }}>{shareLabel}</p>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: summary ? 10 : 0 }}>
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
            {job.jobType && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.jobType}
              </span>
            )}
            {job.remoteOption && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.remoteOption}
              </span>
            )}
            {job.salary && (
              <span style={{ padding: "2px 8px", border: "1px solid rgba(26,58,47,0.22)", background: "rgba(26,58,47,0.05)", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                {job.salary}
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
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55, margin: 0 }}>
                  {summary}
                </p>
              )}
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

      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap" }}>
        {onSave && (
          <ScoutPrimaryBtn onClick={() => onSave()} disabled={saving}>
            {saving ? "Saving…" : "Save job"}
          </ScoutPrimaryBtn>
        )}
        {internalView && (job.topEchelonUrl || job.sourceUrl) && (
          <a
            href={job.topEchelonUrl ?? job.sourceUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
          >
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

  const [jobs, setJobs] = useState<NetworkMatchedJob[]>(() => readNetworkJobsCache()?.jobs ?? seedAsMatched(SEED_NETWORK_JOBS));
  const [loading, setLoading] = useState(() => !readNetworkJobsCache());
  const [needsProfile, setNeedsProfile] = useState(() => readNetworkJobsCache()?.needsProfile ?? false);
  const [profileHint, setProfileHint] = useState<string | null>(() => readNetworkJobsCache()?.hint ?? null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState<NetworkJobFilterForm>(() => ({
    ...createEmptyNetworkJobFilterForm(),
    search: loadScopedNetworkSearch(),
  }));
  const [appliedForm, setAppliedForm] = useState<NetworkJobFilterForm>(() => createEmptyNetworkJobFilterForm());
  const [showFilters, setShowFilters] = useState(false);
  const [profileSuggestedLabels, setProfileSuggestedLabels] = useState<string[]>([]);
  const profileFormRef = useRef<NetworkJobFilterForm | null>(null);
  const autoAppliedProfileRef = useRef(false);

  const loadJobs = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force) {
      const cached = readNetworkJobsCache();
      if (cached) {
        setJobs(cached.jobs);
        setNeedsProfile(Boolean(cached.needsProfile));
        setProfileHint(cached.hint ?? null);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(withClientScope("/api/network-jobs/match"));
      const data = (await res.json()) as {
        jobs?: NetworkMatchedJob[];
        needsProfile?: boolean;
        hint?: string;
      };
      if (res.ok && Array.isArray(data.jobs) && data.jobs.length) {
        setJobs(data.jobs);
        setNeedsProfile(Boolean(data.needsProfile));
        setProfileHint(data.hint ?? null);
        writeNetworkJobsCache({
          jobs: data.jobs,
          fetchedAt: Date.now(),
          needsProfile: data.needsProfile,
          hint: data.hint ?? null,
        });
      }
    } catch {
      setJobs(seedAsMatched(SEED_NETWORK_JOBS));
      setNeedsProfile(false);
      setProfileHint(null);
    } finally {
      setLoading(false);
    }
  }, [withClientScope]);

  useEffect(() => {
    autoAppliedProfileRef.current = false;
    setAppliedForm(createEmptyNetworkJobFilterForm());
    setProfileSuggestedLabels([]);
    profileFormRef.current = null;
    const cached = readNetworkJobsCache();
    if (cached) {
      setJobs(cached.jobs);
      setNeedsProfile(Boolean(cached.needsProfile));
      setProfileHint(cached.hint ?? null);
      setLoading(false);
    } else {
      void loadJobs();
    }

    void Promise.all([
      fetch(withClientScope("/api/jobs/recommended/defaults")).then((res) => (res.ok ? res.json() : null)),
      fetch(withClientScope("/api/profile")).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([defaultsData, profileData]: [
        { filters?: VectorSearchFilters; labels?: string[] } | null,
        { targetRoles?: string[]; prioritizedRoles?: string[] } | null,
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
          const fields = locationFieldsFromProfileString(
            (profileData as { parsedData?: { location?: string | null } } | null)?.parsedData?.location,
          );
          profileForm = {
            ...createEmptyNetworkJobFilterForm(),
            jobTitles: targetRoles.join(", "),
            locationCity: fields.city,
            locationState: fields.region,
          };
        }
        profileForm.search = loadScopedNetworkSearch();
        profileFormRef.current = profileForm;
        setForm(profileForm);
        setProfileSuggestedLabels(
          defaultsData?.labels?.length ? defaultsData.labels : describeNetworkActiveFilters(profileForm),
        );
        if (!autoAppliedProfileRef.current) {
          autoAppliedProfileRef.current = true;
          setAppliedForm(profileForm);
        }
      })
      .catch(() => {
        setForm({ ...createEmptyNetworkJobFilterForm(), search: loadScopedNetworkSearch() });
      });
  }, [actingUserId, loadJobs, withClientScope]);

  const suggestions = useMemo(() => buildNetworkJobFilterSuggestions(jobs), [jobs]);
  const visibleJobs = useMemo(() => {
    const filtered = filterNetworkJobsFromForm(jobs, appliedForm, { internalView });
    return sortNetworkMatchedJobs(filtered);
  }, [jobs, appliedForm, internalView]);
  const activeFilterCount = countActiveNetworkFilterFields(appliedForm, internalView);
  const activeFilterLabels = useMemo(() => describeNetworkActiveFilters(appliedForm), [appliedForm]);
  const hasActiveSearch = Boolean(appliedForm.search.trim());

  const applyFilters = (nextForm = form) => {
    saveScopedNetworkSearch(nextForm.search);
    setAppliedForm({ ...nextForm });
  };

  const applyProfileSuggestions = () => {
    const suggested = profileFormRef.current;
    if (!suggested) return;
    const next = { ...suggested, search: form.search };
    setForm(next);
    applyFilters(next);
  };

  const clearFilters = () => {
    const baseline = profileFormRef.current ?? createEmptyNetworkJobFilterForm();
    saveScopedNetworkSearch("");
    const reset = { ...baseline, search: "" };
    setForm(reset);
    setAppliedForm(reset);
  };

  return (
    <div style={{ padding: embedded ? 0 : isMobile ? "20px 16px 32px" : "32px 36px 48px" }}>
      {!embedded && (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: "#C4A86A", display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Premium recruiter network{internalView ? " · internal" : ""}</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>
          In-Network Roles
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          {internalView
            ? "Staff view — TE/ET channel tags on every listing, plus fee and status filters. Partner names stay in the internal drawer only."
            : NETWORK_JOB_CLIENT_INTRO}
        </p>
      </div>
      )}

      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoutLabel>In-Network Roles</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              {internalView
                ? "Staff view — fees, guarantees, and partner links in the drawer. Filter by TE or ET channel."
                : "Roles shared with you — filter by TE or ET channel, sorted by profile match."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ScoutSecondaryBtn onClick={() => void loadJobs({ force: true })} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </ScoutSecondaryBtn>
            <ScoutSecondaryBtn onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide filters" : activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
            </ScoutSecondaryBtn>
            {activeFilterCount > 0 && (
              <ScoutSecondaryBtn onClick={clearFilters}>Reset</ScoutSecondaryBtn>
            )}
            <ScoutPrimaryBtn onClick={() => applyFilters()}>
              {hasActiveSearch ? "Search" : "Apply filters"}
            </ScoutPrimaryBtn>
          </div>
        </div>

        <FilterField label="Search">
          <input
            style={pipelineInputStyle}
            value={form.search}
            onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
              }
            }}
            placeholder="e.g. remote attorney, healthcare contract, Sacramento"
            maxLength={400}
          />
        </FilterField>

        {showFilters && profileSuggestedLabels.length > 0 && activeFilterCount === 0 && (
          <ProfileSuggestionsBanner
            labels={profileSuggestedLabels}
            onApply={applyProfileSuggestions}
            hint="Uses the same profile defaults as Open Roles — click Apply & search or edit fields below."
          />
        )}

        {showFilters && (
          <NetworkJobFiltersGrid form={form} setForm={setForm} suggestions={suggestions} internalView={internalView} />
        )}

        <ActiveFiltersBar labels={activeFilterLabels} onClear={activeFilterCount > 0 ? clearFilters : undefined} />

        {needsProfile && profileHint && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45, background: surface.inset, padding: "10px 12px", border: border.line }}>
            {profileHint}
          </p>
        )}

        {!loading && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 12, lineHeight: 1.45 }}>
            {visibleJobs.length === jobs.length
              ? `${jobs.length} role${jobs.length === 1 ? "" : "s"}`
              : `${visibleJobs.length} of ${jobs.length} roles match`}
          </p>
        )}
      </ScoutBox>

      {loading ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>Loading network roles…</p>
        </ScoutBox>
      ) : visibleJobs.length === 0 ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
            No roles match these filters — broaden your search or clear filters.
          </p>
        </ScoutBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleJobs.map((job) => (
            <NetworkJobCard
              key={job.id}
              job={job}
              internalView={internalView}
              onOpen={() => onOpenJob(job)}
              onSave={onSaveJob ? () => {
                setSavingId(job.id);
                onSaveJob(job).finally(() => setSavingId(null));
              } : undefined}
              saving={savingId === job.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
