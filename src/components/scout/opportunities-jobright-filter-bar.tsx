"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  multiValuePillLabel,
} from "@/lib/recommended-filter-utils";
import { POSTED_WITHIN_OPTIONS } from "@/lib/job-posted-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { pipelineInputStyle } from "./pipeline-filters-ui";
import {
  HIREBASE_JOB_TYPES,
  HIREBASE_LOCATION_TYPES,
} from "@/lib/vector-matched-job";
import { JOBRIGHT_EXPERIENCE_LEVELS, hirebaseLevelsFromExperienceLabelSet, toggleJobrightExperienceLabel } from "@/lib/search-preferences";
import { isCanadianLocationCountry } from "@/lib/recommended-filter-utils";
import { JobFunctionDropdown, jobFunctionPillItems } from "./job-function-dropdown";
import type { RecommendedFilterForm } from "./pipeline-recommended-filters";

const ACTIVE_PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(45, 107, 74, 0.35)",
  background: "rgba(45, 107, 74, 0.12)",
  color: color.forest,
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const INACTIVE_PILL: React.CSSProperties = {
  ...ACTIVE_PILL,
  border: border.line,
  background: surface.card,
  color: color.ink,
  fontWeight: 500,
};

function jobTypeDisplay(type: string): string {
  return type.replace("Full Time", "Full-time").replace("Part Time", "Part-time");
}

function workModelDisplay(type: string): string {
  if (type === "In-Person") return "Onsite";
  if (type === "Remote") return "Remote";
  return type;
}

function experienceLabelsFromForm(form: RecommendedFilterForm): string[] {
  return [...form.experienceLevelLabels];
}

function DropdownPill({
  label,
  active,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  active?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" style={active ? ACTIVE_PILL : INACTIVE_PILL}>
          {label}
          <ChevronDown size={14} style={{ opacity: 0.65 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0 shadow-lg"
        style={{ background: surface.card, border: border.line, borderRadius: 8 }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PopoverPad({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "12px 14px" }}>{children}</div>;
}

function PopoverFooter({
  onReset,
  onConfirm,
}: {
  onReset: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        borderTop: border.line,
      }}
    >
      <button
        type="button"
        onClick={onReset}
        style={{
          border: "none",
          background: "transparent",
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 600,
          color: color.muted,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onConfirm}
        style={{
          border: "none",
          background: "transparent",
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 700,
          color: color.forest,
          cursor: "pointer",
        }}
      >
        Confirm
      </button>
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        fontFamily: fontSans,
        fontSize: T.caption,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input id={id} type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );
}

function RadioRow({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        fontFamily: fontSans,
        fontSize: T.caption,
        cursor: "pointer",
      }}
    >
      <input type="radio" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

export function OpportunitiesJobrightFilterBar({
  form,
  appliedForm = form,
  setForm,
  toggleSet,
  categorySuggestions,
  onQuickApply,
  onOpenAllFilters,
  activeFilterCount,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searching,
  profileCountry,
  trailingActions,
}: {
  form: RecommendedFilterForm;
  /** Applied filters — drives pill labels and active styling (form is the edit draft). */
  appliedForm?: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  categorySuggestions?: string[];
  onQuickApply: (nextForm: RecommendedFilterForm) => void;
  onOpenAllFilters: () => void;
  activeFilterCount: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  searching?: boolean;
  /** Profile country — used to prioritize Canada in location quick filter. */
  profileCountry?: string;
  /** Refresh, sort, etc. — rendered on the same row as filter pills (Jobright layout). */
  trailingActions?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecommendedFilterForm>(form);
  const preferCanada = isCanadianLocationCountry(form.locationCountry || profileCountry);

  const openDraft = (key: string) => {
    setDraft(form);
    setOpenKey(key);
  };

  const confirmDraft = () => {
    setForm(draft);
    onQuickApply(draft);
    setOpenKey(null);
  };

  const labels = useMemo(() => {
    const jobFns = jobFunctionPillItems(appliedForm);
    const expLabels = experienceLabelsFromForm(appliedForm);
    const types = [...appliedForm.jobTypes].map(jobTypeDisplay);
    const remote = [...appliedForm.locationTypes].map(workModelDisplay);
    const industries = appliedForm.industries.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    const dateLabel = appliedForm.datePostedWithinDays
      ? POSTED_WITHIN_OPTIONS.find((o) => String(o.days) === appliedForm.datePostedWithinDays)?.label ?? "Date Posted"
      : "Date Posted";

    let locationLabel = "Location";
    if (appliedForm.locationAllInCountry && appliedForm.locationCountry.trim()) {
      locationLabel =
        appliedForm.locationCountry === "United States"
          ? "Anywhere in the US"
          : appliedForm.locationCountry === "Canada"
            ? "Anywhere in Canada"
            : `Anywhere in ${appliedForm.locationCountry}`;
    } else if (appliedForm.locationCountry.trim()) {
      locationLabel = appliedForm.locationCountry.trim();
    } else if (appliedForm.locationCity.trim()) {
      locationLabel = appliedForm.locationCity.trim();
    }

    return {
      locationLabel,
      jobFnLabel: multiValuePillLabel(jobFns, "Job Function"),
      expLabel: multiValuePillLabel(expLabels, "Experience Level"),
      typesLabel: multiValuePillLabel(types, "Job Type"),
      remoteLabel: multiValuePillLabel(remote, "Work Model"),
      dateLabel,
      industryLabel: industries.length ? multiValuePillLabel(industries, "Industry") : "Industry",
    };
  }, [appliedForm]);

  const hasLocation =
    Boolean(appliedForm.locationCountry.trim()) ||
    Boolean(appliedForm.locationCity.trim()) ||
    Boolean(appliedForm.locationRegion.trim()) ||
    appliedForm.locationAllInCountry;
  const hasJobFn = jobFunctionPillItems(appliedForm).length > 0;
  const hasExp = appliedForm.experienceLevelLabels.size > 0;
  const hasTypes = appliedForm.jobTypes.size > 0;
  const hasRemote = appliedForm.locationTypes.size > 0;
  const hasIndustry = Boolean(appliedForm.industries.trim());
  const hasDate = Boolean(appliedForm.datePostedWithinDays);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          flex: "1 1 280px",
          minWidth: 0,
        }}
      >
        <DropdownPill
          label={labels.locationLabel}
          active={hasLocation}
          open={openKey === "location"}
          onOpenChange={(o) => (o ? openDraft("location") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Country
            </p>
            {(preferCanada
              ? ([
                  { label: "Canada", value: "Canada" },
                  { label: "United States", value: "United States" },
                ] as const)
              : ([
                  { label: "United States", value: "United States" },
                  { label: "Canada", value: "Canada" },
                ] as const)
            ).map(({ label, value }) => (
              <RadioRow
                key={value}
                label={label}
                checked={draft.locationCountry === value}
                onSelect={() =>
                  setDraft((d) => ({
                    ...d,
                    locationCountry: value,
                    ...(value === "Canada"
                      ? { locationAllInCountry: false, locationCity: "", locationRegion: "" }
                      : {}),
                  }))
                }
              />
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px", flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: 0 }}>
                Location
              </p>
              {(draft.locationCountry === "United States" || draft.locationCountry === "Canada") && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: fontSans,
                    fontSize: T.label,
                    color: color.muted,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.locationAllInCountry}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        locationAllInCountry: e.target.checked,
                        locationCity: e.target.checked ? "" : d.locationCity,
                        locationRegion: e.target.checked ? "" : d.locationRegion,
                      }))
                    }
                  />
                  {draft.locationCountry === "Canada"
                    ? "All locations within Canada"
                    : "All locations within the US"}
                </label>
              )}
            </div>

            {!draft.locationAllInCountry && (
              <input
                style={pipelineInputStyle}
                value={draft.locationCity}
                onChange={(e) => setDraft((d) => ({ ...d, locationCity: e.target.value }))}
                placeholder={draft.locationCountry === "Canada" ? "Enter City or Province" : "Enter City"}
              />
            )}
          </PopoverPad>
          <PopoverFooter
            onReset={() =>
              setDraft((d) => ({
                ...d,
                locationCity: "",
                locationRegion: "",
                locationCountry: "",
                locationAllInCountry: false,
                locationRadiusMiles: "",
              }))
            }
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.jobFnLabel}
          active={hasJobFn}
          open={openKey === "jobfn"}
          onOpenChange={(o) => (o ? openDraft("jobfn") : setOpenKey(null))}
        >
          <PopoverPad>
            <JobFunctionDropdown
              selected={draft.jobCategories.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)}
              customSelected={draft.customJobFunctions ?? []}
              onChange={(taxonomy, custom) =>
                setDraft((d) => ({
                  ...d,
                  jobCategories: taxonomy.join(", "),
                  customJobFunctions: custom,
                }))
              }
              suggested={categorySuggestions}
            />
          </PopoverPad>
          <PopoverFooter
            onReset={() => setDraft((d) => ({ ...d, jobCategories: "", customJobFunctions: [] }))}
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.expLabel}
          active={hasExp}
          open={openKey === "experience"}
          onOpenChange={(o) => (o ? openDraft("experience") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Experience Level
            </p>
            {JOBRIGHT_EXPERIENCE_LEVELS.map(({ id, label }) => (
              <CheckboxRow
                key={id}
                id={`exp-level-${id}`}
                label={label}
                checked={draft.experienceLevelLabels.has(label)}
                onToggle={() => {
                  setDraft((d) => {
                    const experienceLevelLabels = toggleJobrightExperienceLabel(d.experienceLevelLabels, label);
                    return {
                      ...d,
                      experienceLevelLabels,
                      experienceLevels: new Set(hirebaseLevelsFromExperienceLabelSet(experienceLevelLabels)),
                    };
                  });
                }}
              />
            ))}
          </PopoverPad>
          <PopoverFooter
            onReset={() =>
              setDraft((d) => ({ ...d, experienceLevelLabels: new Set(), experienceLevels: new Set() }))
            }
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.typesLabel}
          active={hasTypes}
          open={openKey === "jobtype"}
          onOpenChange={(o) => (o ? openDraft("jobtype") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Job Type
            </p>
            {HIREBASE_JOB_TYPES.map((t) => (
              <CheckboxRow
                key={t}
                id={`job-type-${t.replace(/\s+/g, "-").toLowerCase()}`}
                label={jobTypeDisplay(t)}
                checked={draft.jobTypes.has(t)}
                onToggle={() =>
                  setDraft((d) => ({ ...d, jobTypes: toggleSet(d.jobTypes, t) }))
                }
              />
            ))}
          </PopoverPad>
          <PopoverFooter
            onReset={() => setDraft((d) => ({ ...d, jobTypes: new Set() }))}
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.remoteLabel}
          active={hasRemote}
          open={openKey === "workmodel"}
          onOpenChange={(o) => (o ? openDraft("workmodel") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Work Model
            </p>
            {HIREBASE_LOCATION_TYPES.map((t) => (
              <CheckboxRow
                key={t}
                id={`work-model-${t.replace(/\s+/g, "-").toLowerCase()}`}
                label={workModelDisplay(t)}
                checked={draft.locationTypes.has(t)}
                onToggle={() =>
                  setDraft((d) => ({ ...d, locationTypes: toggleSet(d.locationTypes, t) }))
                }
              />
            ))}
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0 0", lineHeight: 1.4 }}>
              Work model is applied after Hirebase results (API has no remote/hybrid param).
            </p>
          </PopoverPad>
          <PopoverFooter
            onReset={() => setDraft((d) => ({ ...d, locationTypes: new Set() }))}
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.dateLabel}
          active={hasDate}
          open={openKey === "date"}
          onOpenChange={(o) => (o ? openDraft("date") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Date Posted
            </p>
            <RadioRow
              label="Any time"
              checked={!draft.datePostedWithinDays}
              onSelect={() => setDraft((d) => ({ ...d, datePostedWithinDays: "" }))}
            />
            {POSTED_WITHIN_OPTIONS.map((opt) => (
              <RadioRow
                key={opt.days}
                label={opt.label}
                checked={draft.datePostedWithinDays === String(opt.days)}
                onSelect={() => setDraft((d) => ({ ...d, datePostedWithinDays: String(opt.days) }))}
              />
            ))}
          </PopoverPad>
          <PopoverFooter
            onReset={() => setDraft((d) => ({ ...d, datePostedWithinDays: "" }))}
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <DropdownPill
          label={labels.industryLabel}
          active={hasIndustry}
          open={openKey === "industry"}
          onOpenChange={(o) => (o ? openDraft("industry") : setOpenKey(null))}
        >
          <PopoverPad>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
              Industry
            </p>
            <input
              style={pipelineInputStyle}
              value={draft.industries}
              onChange={(e) => setDraft((d) => ({ ...d, industries: e.target.value }))}
              placeholder="Software, Healthcare"
            />
          </PopoverPad>
          <PopoverFooter
            onReset={() => setDraft((d) => ({ ...d, industries: "" }))}
            onConfirm={confirmDraft}
          />
        </DropdownPill>

        <div style={{ width: 1, height: 24, background: "rgba(17,17,17,0.14)", margin: "0 2px" }} aria-hidden />

        <button
          type="button"
          onClick={onOpenAllFilters}
          style={{
            ...(activeFilterCount > 0 ? ACTIVE_PILL : INACTIVE_PILL),
            fontWeight: activeFilterCount > 0 ? 600 : 500,
          }}
        >
          All Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {onSearchChange && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: isMobile ? "1 1 100%" : "0 1 240px",
            minWidth: isMobile ? undefined : 180,
          }}
        >
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit?.();
              }
            }}
            placeholder="Search by title or company"
            aria-label="Search by title or company"
            maxLength={400}
            style={{ ...pipelineInputStyle, width: "100%", margin: 0, padding: "7px 10px", fontSize: T.label }}
          />
          {onSearchSubmit && (
            <button
              type="button"
              onClick={onSearchSubmit}
              disabled={searching}
              style={{
                padding: "7px 12px",
                background: color.forest,
                color: color.gold,
                border: border.lineStrong,
                borderRadius: 999,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 600,
                cursor: searching ? "not-allowed" : "pointer",
                opacity: searching ? 0.65 : 1,
                flexShrink: 0,
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          )}
        </div>
      )}

      {trailingActions ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            marginLeft: isMobile ? 0 : "auto",
            width: isMobile ? "100%" : "auto",
            justifyContent: isMobile ? "flex-end" : undefined,
          }}
        >
          {trailingActions}
        </div>
      ) : null}
    </div>
  );
}
