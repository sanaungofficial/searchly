"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HIREBASE_COMPANY_SIZE_BUCKETS,
  HIREBASE_EXPERIENCE_LEVELS,
  HIREBASE_JOB_TYPES,
  HIREBASE_LOCATION_TYPES,
} from "@/lib/vector-matched-job";
import {
  mergeRecommendationPriorities,
  RECOMMENDATION_RELOCATION_PRIORITIES,
} from "@/lib/recommendation-preferences";
import {
  HIREBASE_FILTER_COUNTRIES,
  HIREBASE_FILTER_US_STATES,
} from "@/lib/recommended-filter-utils";
import { POSTED_WITHIN_OPTIONS } from "@/lib/job-posted-filter";
import { LOCATION_RADIUS_OPTIONS } from "@/lib/job-location-radius";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import {
  ChipToggle,
  DatalistInput,
  FilterField,
  FilterSectionHeader,
  pipelineInputStyle,
} from "./pipeline-filters-ui";

export type RecommendedFilterForm = {
  semanticQuery: string;
  jobTitles: string;
  keywords: string;
  companyName: string;
  industries: string;
  subindustries: string;
  jobCategories: string;
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
  companySizeBuckets: Set<string>;
  visaSponsored: boolean;
  relocationPriorities: string[];
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

  const expLevels = [...form.experienceLevels];
  const expLabel =
    expLevels.length === 0
      ? "Experience level"
      : expLevels.length <= 2
        ? expLevels.join(", ")
        : `${expLevels.length} levels`;

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

function AllFiltersDrawerContent({
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
  const isMobile = useIsMobile();
  const locationGrid = isMobile ? "1fr" : "1.2fr 1fr 1fr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <FilterSectionHeader
        title="Where & how you want to work"
        hint="Set your anchor city, then choose a mile radius. Remote roles always show. Saved to your profile when you search."
      />
      <div style={{ display: "grid", gridTemplateColumns: locationGrid, gap: 12, marginBottom: 14 }}>
        <FilterField label="City">
          <input
            style={pipelineInputStyle}
            value={form.locationCity}
            onChange={(e) => setForm((f) => ({ ...f, locationCity: e.target.value }))}
            placeholder="Baltimore"
          />
        </FilterField>
        <FilterField label="State / region">
          <DatalistInput
            value={form.locationRegion}
            onChange={(locationRegion) => setForm((f) => ({ ...f, locationRegion }))}
            listId="drawer-region-suggestions"
            options={[...HIREBASE_FILTER_US_STATES]}
            placeholder="Maryland"
          />
        </FilterField>
        <FilterField label="Country">
          <DatalistInput
            value={form.locationCountry}
            onChange={(locationCountry) => setForm((f) => ({ ...f, locationCountry }))}
            listId="drawer-country-suggestions"
            options={[...HIREBASE_FILTER_COUNTRIES]}
            placeholder="United States"
          />
        </FilterField>
      </div>

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

      <FilterField label="Work arrangement">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {HIREBASE_LOCATION_TYPES.map((t) => (
            <ChipToggle
              key={t}
              label={t}
              active={form.locationTypes.has(t)}
              onClick={() => setForm((f) => ({ ...f, locationTypes: toggleSet(f.locationTypes, t) }))}
            />
          ))}
        </div>
      </FilterField>

      <FilterField label="Open to relocating">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {RECOMMENDATION_RELOCATION_PRIORITIES.map((pref) => (
            <ChipToggle
              key={pref}
              label={pref.replace("Open to relocating ", "").replace(/^./, (c) => c.toUpperCase())}
              active={form.relocationPriorities.includes(pref)}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  relocationPriorities: mergeRecommendationPriorities(
                    f.relocationPriorities,
                    pref,
                    !f.relocationPriorities.includes(pref),
                  ),
                }))
              }
            />
          ))}
        </div>
      </FilterField>

      <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
        <FilterSectionHeader
          title="Role criteria"
          hint="Titles and keywords for a live job search — comma-separate multiples."
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        <FilterField label="Job titles">
          <input
            style={pipelineInputStyle}
            value={form.jobTitles}
            onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))}
            placeholder="Strategy Manager, VP Ops"
          />
        </FilterField>
        <FilterField label="Keywords">
          <input
            style={pipelineInputStyle}
            value={form.keywords}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            placeholder="remote, B2B SaaS"
          />
        </FilterField>
        <FilterField label="Company">
          <DatalistInput
            value={form.companyName}
            onChange={(companyName) => setForm((f) => ({ ...f, companyName }))}
            listId="drawer-company-suggestions"
            options={trackedCompanyNames}
            placeholder={trackedCompanyNames.length ? "Tracked or any company" : "Stripe"}
          />
        </FilterField>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: border.line,
        }}
      >
        <FilterField label="Posted within">
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
        <FilterField label="Salary from ($)">
          <input
            type="number"
            style={pipelineInputStyle}
            value={form.salaryFrom}
            onChange={(e) => setForm((f) => ({ ...f, salaryFrom: e.target.value }))}
            placeholder="150000"
            min={0}
          />
        </FilterField>
        <FilterField label="Salary to ($)">
          <input
            type="number"
            style={pipelineInputStyle}
            value={form.salaryTo}
            onChange={(e) => setForm((f) => ({ ...f, salaryTo: e.target.value }))}
            placeholder="250000"
            min={0}
          />
        </FilterField>
        <div style={{ gridColumn: "1 / -1" }}>
          <FilterField label="Employment type">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {HIREBASE_JOB_TYPES.map((t) => (
                <ChipToggle
                  key={t}
                  label={t}
                  active={form.jobTypes.has(t)}
                  onClick={() => setForm((f) => ({ ...f, jobTypes: toggleSet(f.jobTypes, t) }))}
                />
              ))}
            </div>
          </FilterField>
          <FilterField label="Experience level">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {HIREBASE_EXPERIENCE_LEVELS.map((t) => (
                <ChipToggle
                  key={t}
                  label={t}
                  active={form.experienceLevels.has(t)}
                  onClick={() => setForm((f) => ({ ...f, experienceLevels: toggleSet(f.experienceLevels, t) }))}
                />
              ))}
            </div>
          </FilterField>
          <FilterField label="Company size">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {HIREBASE_COMPANY_SIZE_BUCKETS.map((t) => (
                <ChipToggle
                  key={t}
                  label={t}
                  active={form.companySizeBuckets.has(t)}
                  onClick={() => setForm((f) => ({ ...f, companySizeBuckets: toggleSet(f.companySizeBuckets, t) }))}
                />
              ))}
            </div>
          </FilterField>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.ink,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.visaSponsored}
              onChange={(e) => setForm((f) => ({ ...f, visaSponsored: e.target.checked }))}
            />
            Visa sponsorship only
          </label>
        </div>
      </div>
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
          zIndex: 60,
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
          zIndex: 61,
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
        active={form.experienceLevels.size > 0}
        open={openKey === "experience"}
        onOpenChange={(o) => setOpenKey(o ? "experience" : null)}
      >
        <PopoverSection title="Experience level">
          {HIREBASE_EXPERIENCE_LEVELS.map((level) => (
            <CheckboxOption
              key={level}
              label={level}
              checked={form.experienceLevels.has(level)}
              onToggle={() => {
                const next = {
                  ...form,
                  experienceLevels: toggleSet(form.experienceLevels, level),
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
