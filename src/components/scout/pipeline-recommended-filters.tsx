"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HIREBASE_JOB_TYPES,
  HIREBASE_LOCATION_TYPES,
} from "@/lib/vector-matched-job";
import {
  HIREBASE_FILTER_COUNTRIES,
  HIREBASE_FILTER_US_STATES,
} from "@/lib/recommended-filter-utils";
import { POSTED_WITHIN_OPTIONS } from "@/lib/job-posted-filter";
import { LOCATION_RADIUS_OPTIONS } from "@/lib/job-location-radius";
import { JobFunctionDropdown } from "@/components/scout/job-function-dropdown";
import { IndustrySearchField } from "@/components/scout/industry-search-field";
import { ExcludedTitleSearchField } from "@/components/scout/excluded-title-search-field";
import {
  JOBRIGHT_EXPERIENCE_LEVELS,
  hirebaseLevelsFromExperienceLabelSet,
  toggleJobrightExperienceLabel,
} from "@/lib/search-preferences";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import {
  AllFiltersSectionAnchor,
  ChipToggle,
  CollapsibleTagListField,
  CompanyStageGrid,
  DatalistInput,
  FilterBlockTitle,
  FilterField,
  FilterSectionHeader,
  SalarySliderField,
  TagListField,
  pipelineInputStyle,
} from "./pipeline-filters-ui";

export type RecommendedFilterForm = {
  semanticQuery: string;
  jobTitles: string;
  keywords: string;
  companyName: string;
  excludedCompany: string;
  industries: string;
  excludedIndustries: string;
  subindustries: string;
  skills: string;
  excludedSkills: string;
  jobCategories: string;
  excludedJobTitles: string;
  locationCity: string;
  locationRegion: string;
  locationCountry: string;
  locationRadiusMiles: string;
  datePostedWithinDays: string;
  datePostedFrom: string;
  salaryFrom: string;
  salaryTo: string;
  yearsFrom: string;
  yearsTo: string;
  jobBoard: string;
  locationTypes: Set<string>;
  jobTypes: Set<string>;
  experienceLevels: Set<string>;
  experienceLevelLabels: Set<string>;
  companySizeBuckets: Set<string>;
  companyStages: Set<string>;
  roleTypes: Set<string>;
  visaSponsored: boolean;
  excludeSecurityClearance: boolean;
  excludeUsCitizenOnly: boolean;
  excludeStaffingAgency: boolean;
  openToAllSalary: boolean;
  openToAllExperience: boolean;
  relocationPriorities: string[];
  customJobFunctions: string[];
  locationAllInCountry: boolean;
};

const SALARY_QUICK_OPTIONS = [
  { value: "", label: "Any salary" },
  { value: "40000", label: "$40,000+" },
  { value: "60000", label: "$60,000+" },
  { value: "80000", label: "$80,000+" },
  { value: "100000", label: "$100,000+" },
  { value: "120000", label: "$120,000+" },
  { value: "150000", label: "$150,000+" },
  { value: "200000", label: "$200,000+" },
] as const;

function FilterPill({
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
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: "var(--scout-radius)",
            border: "var(--scout-border)",
            background: active ? surface.inset : surface.card,
            color: active ? color.forest : color.ink,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: active ? 600 : 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {label}
          <ChevronDown size={14} style={{ opacity: 0.65, flexShrink: 0 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto min-w-[220px] max-w-[340px] p-0 shadow-lg"
        style={{ background: surface.card, border: "var(--scout-border)", borderRadius: "var(--scout-radius)" }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PopoverSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 14px" }}>
      {title && (
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.label,
            fontWeight: 700,
            color: color.forest,
            margin: "0 0 10px",
            letterSpacing: "0.03em",
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function RadioOption({
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
        color: color.ink,
        cursor: "pointer",
      }}
    >
      <input type="radio" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function CheckboxOption({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 0",
        fontFamily: fontSans,
        fontSize: T.caption,
        color: color.ink,
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );
}

function locationQuickLabel(form: RecommendedFilterForm): string {
  const parts = [form.locationCity, form.locationRegion, form.locationCountry].filter(Boolean);
  if (!parts.length) return "Location";
  if (parts.length === 1) return parts[0]!;
  return parts.slice(0, 2).join(", ");
}

function quickFilterLabel(form: RecommendedFilterForm) {
  const dateLabel = form.datePostedWithinDays
    ? POSTED_WITHIN_OPTIONS.find((o) => String(o.days) === form.datePostedWithinDays)?.label ?? "Date posted"
    : "Date posted";

  const expLabels = [...form.experienceLevelLabels];
  const expLabel =
    expLabels.length === 0
      ? "Experience level"
      : expLabels.length <= 2
        ? expLabels.join(", ")
        : `${expLabels.length} levels`;

  const salaryOpt = SALARY_QUICK_OPTIONS.find((o) => o.value === form.salaryFrom);
  const salaryLabel = salaryOpt && salaryOpt.value ? salaryOpt.label : form.salaryFrom ? `$${Number(form.salaryFrom).toLocaleString()}+` : "Salary";

  const companyLabel = form.companyName.trim() ? form.companyName.trim() : "Company";

  const locTypes = [...form.locationTypes];
  const remoteLabel =
    locTypes.length === 0
      ? "Remote"
      : locTypes.length <= 2
        ? locTypes.join(", ")
        : `${locTypes.length} types`;

  return { dateLabel, expLabel, salaryLabel, companyLabel, remoteLabel };
}

function splitFormList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function jobFunctionSelected(form: RecommendedFilterForm): string[] {
  return splitFormList(form.jobCategories);
}

export type AllFiltersSectionId =
  | "basic"
  | "compensation"
  | "interests"
  | "company";

export const ALL_FILTER_SECTIONS: { id: AllFiltersSectionId; title: string; hint: string }[] = [
  { id: "basic", title: "Basic Job Criteria", hint: "Job Function / Job Type / Work Model…" },
  { id: "compensation", title: "Compensation & Sponsorship", hint: "Annual Salary / H1B Sponsorship" },
  { id: "interests", title: "Areas of Interests", hint: "Industry / Skill…" },
  { id: "company", title: "Company Insights", hint: "Company Search / Exclude Staffing Agency…" },
];

function BasicJobCriteriaFields({
  form,
  setForm,
  toggleSet,
  categorySuggestions,
  isMobile,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  categorySuggestions?: string[];
  isMobile: boolean;
}) {
  const locationGrid = isMobile ? "1fr" : "1.2fr 1fr 1fr";

  return (
    <>
      <FilterField label="Job Function">
        <JobFunctionDropdown
          selected={jobFunctionSelected(form)}
          customSelected={form.customJobFunctions ?? []}
          onChange={(taxonomy, custom) =>
            setForm((f) => ({
              ...f,
              jobCategories: taxonomy.join(", "),
              customJobFunctions: custom,
            }))
          }
          suggested={categorySuggestions}
        />
      </FilterField>
      <FilterField label="Excluded Title">
        <ExcludedTitleSearchField
          value={form.excludedJobTitles}
          onChange={(excludedJobTitles) => setForm((f) => ({ ...f, excludedJobTitles }))}
        />
      </FilterField>
      <FilterField label="Job Type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HIREBASE_JOB_TYPES.map((t) => (
            <ChipToggle
              key={t}
              label={t.replace("Full Time", "Full-time").replace("Part Time", "Part-time")}
              active={form.jobTypes.has(t)}
              onClick={() => setForm((f) => ({ ...f, jobTypes: toggleSet(f.jobTypes, t) }))}
            />
          ))}
        </div>
      </FilterField>
      <FilterField label="Work Model">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HIREBASE_LOCATION_TYPES.map((t) => (
            <ChipToggle
              key={t}
              label={t === "In-Person" ? "Onsite" : t === "Remote" ? "Remote (US)" : t}
              active={form.locationTypes.has(t)}
              onClick={() => setForm((f) => ({ ...f, locationTypes: toggleSet(f.locationTypes, t) }))}
            />
          ))}
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "6px 0 0" }}>
          Sent to Hirebase as location_types — client backup if API omits a match.
        </p>
      </FilterField>
      <FilterSectionHeader title="Location" hint="" />
      <FilterField label="Country">
        <select
          style={pipelineInputStyle}
          value={form.locationCountry}
          onChange={(e) => {
            const value = e.target.value;
            setForm((f) => ({
              ...f,
              locationCountry: value,
              ...(value === "Canada"
                ? { locationAllInCountry: false, locationCity: "", locationRegion: "" }
                : {}),
            }));
          }}
        >
          <option value="">Select country</option>
          <option value="United States">United States</option>
          <option value="Canada">Canada</option>
          {HIREBASE_FILTER_COUNTRIES.filter((c) => c !== "United States" && c !== "Canada").map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </FilterField>

      {(form.locationCountry === "United States" || form.locationCountry === "Canada") && (
        <>
          <FilterField
            label={
              form.locationCountry === "Canada" ? "All locations within Canada" : "All locations within the US"
            }
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: fontSans,
                fontSize: T.caption,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              <input
                type="checkbox"
                checked={form.locationAllInCountry}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    locationAllInCountry: e.target.checked,
                    locationCity: e.target.checked ? "" : f.locationCity,
                    locationRegion: e.target.checked ? "" : f.locationRegion,
                  }))
                }
              />
              {form.locationCountry === "Canada"
                ? "Open to anywhere in Canada"
                : "Open to anywhere in the United States"}
            </label>
          </FilterField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.4fr 0.8fr",
              gap: 12,
              marginBottom: 8,
              alignItems: "end",
            }}
          >
            <FilterField label={form.locationAllInCountry ? "Location" : "City"}>
              {form.locationAllInCountry ? (
                <input
                  style={pipelineInputStyle}
                  value={
                    form.locationCountry === "United States"
                      ? "Anywhere in the US"
                      : "Anywhere in Canada"
                  }
                  readOnly
                  aria-readonly
                />
              ) : (
                <input
                  style={pipelineInputStyle}
                  value={form.locationCity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      locationCity: e.target.value,
                      locationAllInCountry: false,
                    }))
                  }
                  placeholder="Enter City"
                />
              )}
            </FilterField>
            <FilterField label="Within radius">
              <select
                style={pipelineInputStyle}
                value={form.locationRadiusMiles}
                onChange={(e) => setForm((f) => ({ ...f, locationRadiusMiles: e.target.value }))}
              >
                {LOCATION_RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.miles} value={opt.miles > 0 ? String(opt.miles) : ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "0 0 14px" }}>
            Radius is applied after Hirebase results.
          </p>
        </>
      )}

      {form.locationCountry &&
        form.locationCountry !== "United States" &&
        form.locationCountry !== "Canada" && (
          <div style={{ display: "grid", gridTemplateColumns: locationGrid, gap: 12, marginBottom: 14 }}>
            <FilterField label="City">
              <input
                style={pipelineInputStyle}
                value={form.locationCity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locationCity: e.target.value, locationAllInCountry: false }))
                }
                placeholder="Enter City"
              />
            </FilterField>
            <FilterField label="State / region">
              <DatalistInput
                value={form.locationRegion}
                onChange={(locationRegion) =>
                  setForm((f) => ({ ...f, locationRegion, locationAllInCountry: false }))
                }
                listId="drawer-region-suggestions"
                options={[...HIREBASE_FILTER_US_STATES]}
                placeholder="Region"
              />
            </FilterField>
          </div>
        )}
      <FilterField label="Experience Level">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {JOBRIGHT_EXPERIENCE_LEVELS.map(({ label }) => (
            <ChipToggle
              key={label}
              label={label}
              active={form.experienceLevelLabels.has(label)}
              onClick={() => {
                setForm((f) => {
                  const experienceLevelLabels = toggleJobrightExperienceLabel(f.experienceLevelLabels, label);
                  return {
                    ...f,
                    experienceLevelLabels,
                    experienceLevels: new Set(hirebaseLevelsFromExperienceLabelSet(experienceLevelLabels)),
                  };
                });
              }}
            />
          ))}
        </div>
      </FilterField>
      <FilterField label="Required Experience">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            fontFamily: fontSans,
            fontSize: T.caption,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.openToAllExperience}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                openToAllExperience: e.target.checked,
                yearsFrom: e.target.checked ? "" : f.yearsFrom,
                yearsTo: e.target.checked ? "" : f.yearsTo,
              }))
            }
          />
          Open to all experience levels
        </label>
        {!form.openToAllExperience && (
          <input
            type="range"
            min={0}
            max={15}
            step={1}
            value={form.yearsFrom.trim() ? Number(form.yearsFrom) : 0}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                yearsFrom: e.target.value,
                openToAllExperience: false,
              }))
            }
            style={{ width: "100%", accentColor: color.forest, cursor: "pointer" }}
          />
        )}
      </FilterField>
      <FilterField label="Date Posted">
        <select
          style={pipelineInputStyle}
          value={form.datePostedWithinDays}
          onChange={(e) => setForm((f) => ({ ...f, datePostedWithinDays: e.target.value }))}
        >
          <option value="">Any time</option>
          {POSTED_WITHIN_OPTIONS.map((opt) => (
            <option key={opt.days} value={String(opt.days)}>
              {opt.label}
            </option>
          ))}
        </select>
      </FilterField>
    </>
  );
}

function CompensationFields({
  form,
  setForm,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
}) {
  return (
    <>
      <SalarySliderField
        value={form.salaryFrom}
        openToAll={form.openToAllSalary}
        onValueChange={(salaryFrom) => setForm((f) => ({ ...f, salaryFrom, openToAllSalary: false }))}
        onOpenToAllChange={(openToAllSalary) =>
          setForm((f) => ({
            ...f,
            openToAllSalary,
            salaryFrom: openToAllSalary ? "" : f.salaryFrom || "90000",
          }))
        }
      />
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink, margin: "0 0 8px" }}>
          Work Authorization
        </p>
        <div
          style={{
            padding: "12px 14px",
            border: border.line,
            borderRadius: 10,
            background: surface.inset,
          }}
        >
          <CheckboxOption
            label="H1B sponsorship"
            checked={form.visaSponsored}
            onToggle={() => setForm((f) => ({ ...f, visaSponsored: !f.visaSponsored }))}
          />
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0 0", lineHeight: 1.45 }}>
            Only show roles that explicitly offer visa sponsorship.
          </p>
        </div>
      </div>
      <div>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink, margin: "0 0 10px" }}>
          Exclude Jobs with Limitations
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              border: border.line,
              borderRadius: 10,
              fontFamily: fontSans,
              fontSize: T.caption,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.excludeSecurityClearance}
              onChange={() => setForm((f) => ({ ...f, excludeSecurityClearance: !f.excludeSecurityClearance }))}
            />
            Security Clearance Required
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              border: border.line,
              borderRadius: 10,
              fontFamily: fontSans,
              fontSize: T.caption,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.excludeUsCitizenOnly}
              onChange={() => setForm((f) => ({ ...f, excludeUsCitizenOnly: !f.excludeUsCitizenOnly }))}
            />
            US Citizen Only
          </label>
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0 0" }}>
          Saved to profile — client-side filtering only.
        </p>
      </div>
    </>
  );
}

function InterestsFields({
  form,
  setForm,
  toggleSet,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
}) {
  return (
    <>
      <IndustrySearchField
        title="Industry"
        value={form.industries}
        onChange={(industries) => setForm((f) => ({ ...f, industries, subindustries: "" }))}
      />
      <IndustrySearchField
        title="Excluded Industry"
        value={form.excludedIndustries}
        onChange={(excludedIndustries) => setForm((f) => ({ ...f, excludedIndustries }))}
        collapsible
      />
      <TagListField
        title="Skill"
        value={form.skills}
        onChange={(skills) => setForm((f) => ({ ...f, skills }))}
        placeholder="Python, SQL"
      />
      <CollapsibleTagListField
        title="Excluded Skill"
        value={form.excludedSkills}
        onChange={(excludedSkills) => setForm((f) => ({ ...f, excludedSkills }))}
        placeholder="Cold calling"
      />
    </>
  );
}

function CompanyInsightsFields({
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
}) {
  return (
    <>
      <TagListField
        title="Company"
        value={form.companyName}
        onChange={(companyName) => setForm((f) => ({ ...f, companyName }))}
        placeholder={trackedCompanyNames.length ? "Tracked or any company" : "Stripe"}
      />
      <div style={{ marginBottom: 20 }}>
        <FilterBlockTitle
          title="Company Stage"
          onClear={() => setForm((f) => ({ ...f, companyStages: new Set() }))}
          clearDisabled={form.companyStages.size === 0}
        />
        <CompanyStageGrid
          selected={form.companyStages}
          onToggle={(stage) => setForm((f) => ({ ...f, companyStages: toggleSet(f.companyStages, stage) }))}
        />
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0 0" }}>
          Mapped to Hirebase company_types (Startup, Public Company, …).
        </p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink, margin: "0 0 10px" }}>
          Job Source
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            border: border.line,
            borderRadius: 10,
            fontFamily: fontSans,
            fontSize: T.caption,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.excludeStaffingAgency}
            onChange={() => setForm((f) => ({ ...f, excludeStaffingAgency: !f.excludeStaffingAgency }))}
          />
          Exclude Staffing Agency
        </label>
      </div>
      <TagListField
        title="Exclude Company"
        value={form.excludedCompany}
        onChange={(excludedCompany) => setForm((f) => ({ ...f, excludedCompany }))}
        placeholder="Agency name"
      />
    </>
  );
}

function sectionHasActiveFilters(section: AllFiltersSectionId, form: RecommendedFilterForm): boolean {
  switch (section) {
    case "basic":
      return (
        Boolean(form.jobCategories.trim()) ||
        (form.customJobFunctions?.length ?? 0) > 0 ||
        Boolean(form.excludedJobTitles.trim()) ||
        form.jobTypes.size > 0 ||
        form.locationTypes.size > 0 ||
        Boolean(form.locationCountry.trim()) ||
        Boolean(form.locationCity.trim()) ||
        Boolean(form.locationRegion.trim()) ||
        form.locationAllInCountry ||
        Boolean(form.locationRadiusMiles.trim()) ||
        form.experienceLevelLabels.size > 0 ||
        Boolean(form.yearsFrom.trim()) ||
        Boolean(form.datePostedWithinDays.trim())
      );
    case "compensation":
      return (
        Boolean(form.salaryFrom.trim()) ||
        form.visaSponsored ||
        form.excludeSecurityClearance ||
        form.excludeUsCitizenOnly
      );
    case "interests":
      return (
        Boolean(form.industries.trim()) ||
        Boolean(form.excludedIndustries.trim()) ||
        Boolean(form.skills.trim()) ||
        Boolean(form.excludedSkills.trim())
      );
    case "company":
      return (
        Boolean(form.companyName.trim()) ||
        form.companyStages.size > 0 ||
        form.excludeStaffingAgency ||
        Boolean(form.excludedCompany.trim())
      );
    default:
      return false;
  }
}

export function AllFiltersScrollContent({
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
  sectionRefs,
  onClearSection,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
  sectionRefs?: React.MutableRefObject<Partial<Record<AllFiltersSectionId, HTMLElement | null>>>;
  onClearSection?: (section: AllFiltersSectionId) => void;
}) {
  const isMobile = useIsMobile();

  const bindRef = (id: AllFiltersSectionId) => (el: HTMLElement | null) => {
    if (sectionRefs) sectionRefs.current[id] = el;
  };

  return (
    <>
      <AllFiltersSectionAnchor
        id="basic"
        title="Basic Job Criteria"
        hint="Job Function / Job Type / Work Model / Location / Experience"
        sectionRef={bindRef("basic")}
        onClearAll={onClearSection ? () => onClearSection("basic") : undefined}
        clearDisabled={!sectionHasActiveFilters("basic", form)}
      >
        <BasicJobCriteriaFields
          form={form}
          setForm={setForm}
          toggleSet={toggleSet}
          categorySuggestions={categorySuggestions}
          isMobile={isMobile}
        />
      </AllFiltersSectionAnchor>

      <AllFiltersSectionAnchor
        id="compensation"
        title="Compensation & Sponsorship"
        hint="Annual Salary / H1B Sponsorship / Job limitations"
        sectionRef={bindRef("compensation")}
        onClearAll={onClearSection ? () => onClearSection("compensation") : undefined}
        clearDisabled={!sectionHasActiveFilters("compensation", form)}
      >
        <CompensationFields form={form} setForm={setForm} />
      </AllFiltersSectionAnchor>

      <AllFiltersSectionAnchor
        id="interests"
        title="Areas of Interests"
        hint="Industry / Skill"
        sectionRef={bindRef("interests")}
        onClearAll={onClearSection ? () => onClearSection("interests") : undefined}
        clearDisabled={!sectionHasActiveFilters("interests", form)}
      >
        <InterestsFields form={form} setForm={setForm} toggleSet={toggleSet} />
      </AllFiltersSectionAnchor>

      <AllFiltersSectionAnchor
        id="company"
        title="Company Insights"
        hint="Company Search / Company Stage / Job Source"
        sectionRef={bindRef("company")}
        onClearAll={onClearSection ? () => onClearSection("company") : undefined}
        clearDisabled={!sectionHasActiveFilters("company", form)}
      >
        <CompanyInsightsFields
          form={form}
          setForm={setForm}
          toggleSet={toggleSet}
          trackedCompanyNames={trackedCompanyNames}
        />
      </AllFiltersSectionAnchor>
    </>
  );
}

/** @deprecated Use AllFiltersScrollContent — kept for legacy drawer. */
export function AllFiltersSectionContent({
  section,
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
}: {
  section: AllFiltersSectionId;
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
}) {
  const isMobile = useIsMobile();
  if (section === "basic") {
    return (
      <BasicJobCriteriaFields
        form={form}
        setForm={setForm}
        toggleSet={toggleSet}
        categorySuggestions={categorySuggestions}
        isMobile={isMobile}
      />
    );
  }
  if (section === "compensation") return <CompensationFields form={form} setForm={setForm} />;
  if (section === "interests") {
    return <InterestsFields form={form} setForm={setForm} toggleSet={toggleSet} />;
  }
  return (
    <CompanyInsightsFields
      form={form}
      setForm={setForm}
      toggleSet={toggleSet}
      trackedCompanyNames={trackedCompanyNames}
    />
  );
}

function AllFiltersDrawerContent({
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {ALL_FILTER_SECTIONS.map((section, index) => (
        <div key={section.id} style={index > 0 ? { borderTop: border.line, marginTop: 20, paddingTop: 16 } : undefined}>
          <FilterSectionHeader title={section.title} hint={section.hint} />
          <AllFiltersSectionContent
            section={section.id}
            form={form}
            setForm={setForm}
            toggleSet={toggleSet}
            trackedCompanyNames={trackedCompanyNames}
            categorySuggestions={categorySuggestions}
          />
        </div>
      ))}
    </div>
  );
}

export function RecommendedFiltersDrawer({
  open,
  onClose,
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
  onApply,
  onReset,
  applying,
}: {
  open: boolean;
  onClose: () => void;
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
  onApply: () => void;
  onReset: () => void;
  applying?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: DRAWER_BACKDROP_Z,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: surface.card,
          borderLeft: border.line,
          zIndex: DRAWER_Z,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: border.line,
            flexShrink: 0,
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink, margin: 0 }}>
            All filters
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
              color: color.muted,
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          <AllFiltersDrawerContent
            form={form}
            setForm={setForm}
            toggleSet={toggleSet}
            trackedCompanyNames={trackedCompanyNames}
            categorySuggestions={categorySuggestions}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            borderTop: border.line,
            flexShrink: 0,
            background: surface.card,
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
            onClick={onApply}
            disabled={applying}
            style={{
              padding: "10px 20px",
              border: border.lineStrong,
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 700,
              cursor: applying ? "default" : "pointer",
              opacity: applying ? 0.7 : 1,
            }}
          >
            {applying ? "Loading…" : "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}

export function RecommendedQuickFiltersBar({
  form,
  setForm,
  toggleSet,
  trackedCompanyNames,
  onQuickApply,
  onOpenAllFilters,
  activeFilterCount,
}: {
  form: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  onQuickApply: (nextForm: RecommendedFilterForm) => void;
  onOpenAllFilters: () => void;
  activeFilterCount: number;
}) {
  const labels = useMemo(() => quickFilterLabel(form), [form]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const applyAndClose = (next: RecommendedFilterForm, key: string) => {
    setForm(next);
    onQuickApply(next);
    setOpenKey(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 2,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <FilterPill
        label={locationQuickLabel(form)}
        active={Boolean(form.locationCity.trim() || form.locationRegion.trim() || form.locationCountry.trim())}
        open={openKey === "location"}
        onOpenChange={(o) => setOpenKey(o ? "location" : null)}
      >
        <PopoverSection title="Location">
          <FilterField label="City">
            <input
              style={pipelineInputStyle}
              value={form.locationCity}
              onChange={(e) => setForm((f) => ({ ...f, locationCity: e.target.value }))}
              placeholder="Albany"
            />
          </FilterField>
          <FilterField label="State / region">
            <DatalistInput
              value={form.locationRegion}
              onChange={(locationRegion) => setForm((f) => ({ ...f, locationRegion }))}
              listId="quick-location-region"
              options={[...HIREBASE_FILTER_US_STATES]}
              placeholder="New York"
            />
          </FilterField>
          <FilterField label="Country">
            <DatalistInput
              value={form.locationCountry}
              onChange={(locationCountry) => setForm((f) => ({ ...f, locationCountry }))}
              listId="quick-location-country"
              options={[...HIREBASE_FILTER_COUNTRIES]}
              placeholder="United States"
            />
          </FilterField>
          <button
            type="button"
            onClick={() => applyAndClose(form, "location")}
            style={{
              marginTop: 4,
              width: "100%",
              padding: "8px 12px",
              border: border.lineStrong,
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </PopoverSection>
      </FilterPill>

      <FilterPill
        label={labels.dateLabel}
        active={Boolean(form.datePostedWithinDays)}
        open={openKey === "date"}
        onOpenChange={(o) => setOpenKey(o ? "date" : null)}
      >
        <PopoverSection title="Date posted">
          <RadioOption
            label="Any time"
            checked={!form.datePostedWithinDays}
            onSelect={() => applyAndClose({ ...form, datePostedWithinDays: "" }, "date")}
          />
          {POSTED_WITHIN_OPTIONS.map((opt) => (
            <RadioOption
              key={opt.days}
              label={opt.label}
              checked={form.datePostedWithinDays === String(opt.days)}
              onSelect={() =>
                applyAndClose({ ...form, datePostedWithinDays: String(opt.days) }, "date")
              }
            />
          ))}
        </PopoverSection>
      </FilterPill>

      <FilterPill
        label={labels.expLabel}
        active={form.experienceLevelLabels.size > 0}
        open={openKey === "experience"}
        onOpenChange={(o) => setOpenKey(o ? "experience" : null)}
      >
        <PopoverSection title="Experience level">
          {JOBRIGHT_EXPERIENCE_LEVELS.map(({ label }) => (
            <CheckboxOption
              key={label}
              label={label}
              checked={form.experienceLevelLabels.has(label)}
              onToggle={() => {
                const experienceLevelLabels = toggleJobrightExperienceLabel(form.experienceLevelLabels, label);
                const next = {
                  ...form,
                  experienceLevelLabels,
                  experienceLevels: new Set(hirebaseLevelsFromExperienceLabelSet(experienceLevelLabels)),
                };
                setForm(next);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => applyAndClose(form, "experience")}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              border: border.lineStrong,
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </PopoverSection>
      </FilterPill>

      <FilterPill
        label={labels.salaryLabel}
        active={Boolean(form.salaryFrom)}
        open={openKey === "salary"}
        onOpenChange={(o) => setOpenKey(o ? "salary" : null)}
      >
        <PopoverSection title="Salary">
          {SALARY_QUICK_OPTIONS.map((opt) => (
            <RadioOption
              key={opt.value || "any"}
              label={opt.label}
              checked={form.salaryFrom === opt.value}
              onSelect={() => applyAndClose({ ...form, salaryFrom: opt.value }, "salary")}
            />
          ))}
        </PopoverSection>
      </FilterPill>

      <FilterPill
        label={labels.companyLabel}
        active={Boolean(form.companyName.trim())}
        open={openKey === "company"}
        onOpenChange={(o) => setOpenKey(o ? "company" : null)}
      >
        <PopoverSection title="Company">
          <DatalistInput
            value={form.companyName}
            onChange={(companyName) => setForm((f) => ({ ...f, companyName }))}
            listId="quick-company-suggestions"
            options={trackedCompanyNames}
            placeholder="Company name"
          />
          <button
            type="button"
            onClick={() => applyAndClose(form, "company")}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              border: border.lineStrong,
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </PopoverSection>
      </FilterPill>

      <FilterPill
        label={labels.remoteLabel}
        active={form.locationTypes.size > 0}
        open={openKey === "remote"}
        onOpenChange={(o) => setOpenKey(o ? "remote" : null)}
      >
        <PopoverSection title="Remote">
          {HIREBASE_LOCATION_TYPES.map((type) => (
            <CheckboxOption
              key={type}
              label={type}
              checked={form.locationTypes.has(type)}
              onToggle={() => {
                const next = {
                  ...form,
                  locationTypes: toggleSet(form.locationTypes, type),
                };
                setForm(next);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => applyAndClose(form, "remote")}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              border: border.lineStrong,
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </PopoverSection>
      </FilterPill>

      <div style={{ width: 1, height: 24, background: "rgba(17,17,17,0.14)", margin: "0 2px" }} aria-hidden />

      <button
        type="button"
        onClick={onOpenAllFilters}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 12px",
          borderRadius: 999,
          border: activeFilterCount > 0 ? border.lineStrong : border.line,
          background: activeFilterCount > 0 ? surface.inset : surface.card,
          color: activeFilterCount > 0 ? color.forest : color.ink,
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: activeFilterCount > 0 ? 600 : 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        All filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
    </div>
  );
}
