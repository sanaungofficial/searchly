"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { SEED_NETWORK_JOBS, previewPlainText } from "@/lib/network-job-display";
import { canViewNetworkJobInternal } from "@/lib/network-job-access";
import {
  COMPENSATION_BAND_LABELS,
  createEmptyNetworkJobFilterForm,
  buildNetworkJobFilterSuggestions,
  countActiveNetworkFilterFields,
  filterNetworkJobsFromForm,
  toggleFilterSet,
  type NetworkJobFilterForm,
  type NetworkJobFilterSuggestions,
} from "@/lib/network-job-filters";
import type { CompensationBand } from "@/lib/network-job-format";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface PipelineNetworkSectionProps {
  onOpenJob: (job: NetworkJobListing) => void;
  onSaveJob?: (job: NetworkJobListing) => Promise<void>;
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

function formatFeeTypeLabel(value: string): string {
  if (value === "percentage") return "Percentage fee";
  if (value === "flat") return "Flat fee";
  return value;
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
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 16px", marginTop: 8, paddingTop: 16, borderTop: border.line }}>
      <FilterSectionHeader
        title="Type to filter"
        hint="Free text — matches title, company, location, industry, and description. Separate multiple job titles or keywords with commas."
      />
      <FilterField label="Job titles">
        <input style={inputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="Key Account Manager, Attorney" />
      </FilterField>
      <FilterField label="Keywords">
        <input style={inputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="remote, SaaS, litigation" />
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
      <FilterField label="Industries">
        <DatalistInput
          value={form.industries}
          onChange={(industries) => setForm((f) => ({ ...f, industries }))}
          listId="network-industry-suggestions"
          options={suggestions.industries}
          placeholder="Healthcare, Software"
        />
      </FilterField>
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
      <FilterField label="Shared after">
        <input type="date" style={inputStyle} value={form.sharedAfter} onChange={(e) => setForm((f) => ({ ...f, sharedAfter: e.target.value }))} />
      </FilterField>
      <FilterField label="Compensation from ($)">
        <input type="number" style={inputStyle} value={form.salaryFrom} onChange={(e) => setForm((f) => ({ ...f, salaryFrom: e.target.value }))} placeholder="100000" />
      </FilterField>
      <FilterField label="Compensation to ($)">
        <input type="number" style={inputStyle} value={form.salaryTo} onChange={(e) => setForm((f) => ({ ...f, salaryTo: e.target.value }))} placeholder="250000" />
      </FilterField>

      {internalView && (
        <>
          <FilterField label="Placement fee">
            <input style={inputStyle} value={form.feeQuery} onChange={(e) => setForm((f) => ({ ...f, feeQuery: e.target.value }))} placeholder="20%, $20000 flat" />
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
        </>
      )}

      <FilterSectionHeader
        title="Select options"
        hint="Tap to toggle fixed categories. Combine with the fields above, then Apply filters."
      />

      <div style={{ gridColumn: "1 / -1" }}>
        <FilterField label="Job type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.jobTypes.map((t) => (
              <ChipToggle key={t} label={t} active={form.jobTypes.has(t)} onClick={() => setForm((f) => ({ ...f, jobTypes: toggleFilterSet(f.jobTypes, t) }))} />
            ))}
          </div>
        </FilterField>

        <FilterField label="Work arrangement">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.remoteOptions.map((t) => (
              <ChipToggle key={t} label={t} active={form.remoteOptions.has(t)} onClick={() => setForm((f) => ({ ...f, remoteOptions: toggleFilterSet(f.remoteOptions, t) }))} />
            ))}
          </div>
        </FilterField>

        <FilterField label="Compensation band">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.compensationBands.map((band) => (
              <ChipToggle
                key={band}
                label={COMPENSATION_BAND_LABELS[band]}
                active={form.compensationBands.has(band)}
                onClick={() => setForm((f) => ({ ...f, compensationBands: toggleFilterSet(f.compensationBands, band) }))}
              />
            ))}
          </div>
        </FilterField>

        {internalView && (
          <>
            <FilterField label="Network status">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.statuses.map((t) => (
                  <ChipToggle key={t} label={t} active={form.networkStatuses.has(t)} onClick={() => setForm((f) => ({ ...f, networkStatuses: toggleFilterSet(f.networkStatuses, t) }))} />
                ))}
              </div>
            </FilterField>

            <FilterField label="Fee type">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.feeTypes.map((t) => (
                  <ChipToggle key={t} label={formatFeeTypeLabel(t)} active={form.feeTypes.has(t)} onClick={() => setForm((f) => ({ ...f, feeTypes: toggleFilterSet(f.feeTypes, t) }))} />
                ))}
              </div>
            </FilterField>

            <FilterField label="Guarantee period">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.guarantees.map((t) => (
                  <ChipToggle key={t} label={t} active={form.guarantees.has(t)} onClick={() => setForm((f) => ({ ...f, guarantees: toggleFilterSet(f.guarantees, t) }))} />
                ))}
              </div>
            </FilterField>

            <FilterField label="Recruiting agency">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.agencies.map((t) => (
                  <ChipToggle key={t} label={t} active={form.agencies.has(t)} onClick={() => setForm((f) => ({ ...f, agencies: toggleFilterSet(f.agencies, t) }))} />
                ))}
              </div>
            </FilterField>
          </>
        )}
      </div>
    </div>
  );
}

function NetworkJobCard({
  job,
  internalView,
  onOpen,
  onSave,
  saving,
}: {
  job: NetworkJobListing;
  internalView: boolean;
  onOpen: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const company = job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer";
  const summary = previewPlainText(job.description);
  const shareLabel = job.sharedAt
    ? job.sharedAtRelative
      ? `Shared ${job.sharedAtLabel} · ${job.sharedAtRelative}`
      : `Shared ${job.sharedAtLabel}`
    : null;

  return (
    <ScoutBox stack padding={18} style={{ borderTop: "3px solid rgba(196,168,106,0.55)" }}>
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
        <CompanyLogo name={company} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
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
              Recruiter network
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
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap" }}>
        {onSave && (
          <ScoutPrimaryBtn onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}>
            {saving ? "Saving…" : "Save to pipeline"}
          </ScoutPrimaryBtn>
        )}
        {internalView && job.topEchelonUrl && (
          <a
            href={job.topEchelonUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
          >
            Top Echelon ↗
          </a>
        )}
      </div>
    </ScoutBox>
  );
}

export function PipelineNetworkSection({ onOpenJob, onSaveJob }: PipelineNetworkSectionProps) {
  const { isAdmin, userRole } = useWorkspace();
  const internalView = canViewNetworkJobInternal(userRole, isAdmin);

  const [jobs, setJobs] = useState<NetworkJobListing[]>(SEED_NETWORK_JOBS);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState<NetworkJobFilterForm>(() => createEmptyNetworkJobFilterForm());
  const [appliedForm, setAppliedForm] = useState<NetworkJobFilterForm>(() => createEmptyNetworkJobFilterForm());
  const [showFilters, setShowFilters] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/network-jobs");
      const data = (await res.json()) as { jobs?: NetworkJobListing[] };
      if (res.ok && Array.isArray(data.jobs) && data.jobs.length) {
        setJobs(data.jobs);
      }
    } catch {
      setJobs(SEED_NETWORK_JOBS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const suggestions = useMemo(() => buildNetworkJobFilterSuggestions(jobs), [jobs]);
  const visibleJobs = useMemo(
    () => filterNetworkJobsFromForm(jobs, appliedForm, { internalView }),
    [jobs, appliedForm, internalView]
  );
  const activeFilterCount = countActiveNetworkFilterFields(appliedForm, internalView);
  const hasActiveSearch = Boolean(appliedForm.search.trim());

  const applyFilters = (nextForm = form) => {
    setAppliedForm({
      ...nextForm,
      networkStatuses: new Set(nextForm.networkStatuses),
      jobTypes: new Set(nextForm.jobTypes),
      remoteOptions: new Set(nextForm.remoteOptions),
      compensationBands: new Set(nextForm.compensationBands),
      feeTypes: new Set(nextForm.feeTypes),
      guarantees: new Set(nextForm.guarantees),
      agencies: new Set(nextForm.agencies),
    });
  };

  const clearFilters = () => {
    const empty = createEmptyNetworkJobFilterForm();
    setForm(empty);
    setAppliedForm(createEmptyNetworkJobFilterForm());
  };

  return (
    <div style={{ padding: "32px 36px 48px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: "#C4A86A", display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Premium recruiter network{internalView ? " · internal" : ""}</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>
          In-network & second-tier roles
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          Shared privately through Top Echelon Big Biller — not public job boards. Search or filter to narrow the list, then open a role for match tools and recruiter details.
        </p>
      </div>

      <ScoutBox padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <ScoutLabel>Network roles</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
              {internalView
                ? "Full internal view — fee, guarantee, status, and agency filters available."
                : "Curated roles shared with you. Use search and filters to find the right fit."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ScoutSecondaryBtn onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide filters" : "Filters"}
            </ScoutSecondaryBtn>
            {activeFilterCount > 0 && (
              <ScoutSecondaryBtn onClick={clearFilters}>Clear ({activeFilterCount})</ScoutSecondaryBtn>
            )}
            <ScoutPrimaryBtn onClick={() => applyFilters()}>
              {hasActiveSearch ? "Search" : "Apply filters"}
            </ScoutPrimaryBtn>
          </div>
        </div>

        <FilterField label="Search">
          <input
            style={inputStyle}
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

        {showFilters && (
          <NetworkJobFiltersGrid form={form} setForm={setForm} suggestions={suggestions} internalView={internalView} />
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
            No roles match these filters — try broadening your search or clearing filters.
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
