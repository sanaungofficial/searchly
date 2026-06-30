"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HIREBASE_FILTER_COUNTRIES,
  HIREBASE_FILTER_US_STATES,
  multiValuePillLabel,
  yearsExperienceLabel,
  YEARS_OF_EXPERIENCE_OPTIONS,
} from "@/lib/recommended-filter-utils";
import { POSTED_WITHIN_OPTIONS } from "@/lib/job-posted-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import {
  DatalistInput,
  FilterField,
  pipelineInputStyle,
} from "./pipeline-filters-ui";
import type { RecommendedFilterForm } from "./pipeline-recommended-filters";

const ACTIVE_CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 8px 6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(45, 107, 74, 0.35)",
  background: "rgba(45, 107, 74, 0.12)",
  color: color.forest,
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

function splitFormList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function locationCountryLabel(form: RecommendedFilterForm): string {
  if (form.locationCountry.trim()) return form.locationCountry.trim();
  const parts = [form.locationCity, form.locationRegion].filter(Boolean);
  if (!parts.length) return "Location";
  return parts.join(", ");
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={ACTIVE_CHIP}>
      {label}
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          padding: 0,
          border: "none",
          borderRadius: "50%",
          background: "rgba(26, 58, 47, 0.12)",
          color: color.forest,
          cursor: "pointer",
        }}
      >
        <X size={12} />
      </button>
    </span>
  );
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
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 999,
            border: active ? "1px solid rgba(45, 107, 74, 0.35)" : border.line,
            background: active ? "rgba(45, 107, 74, 0.12)" : surface.card,
            color: active ? color.forest : color.ink,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: active ? 600 : 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {label}
          <ChevronDown size={14} style={{ opacity: 0.65 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto min-w-[220px] max-w-[340px] p-0 shadow-lg"
        style={{ background: surface.card, border: border.line, borderRadius: 8 }}
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
        <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 10px" }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function RadioOption({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontFamily: fontSans, fontSize: T.caption, cursor: "pointer" }}>
      <input type="radio" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function CheckboxOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontFamily: fontSans, fontSize: T.caption, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );
}

export function OpportunitiesJobrightFilterBar({
  form,
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
}: {
  form: RecommendedFilterForm;
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
}) {
  const isMobile = useIsMobile();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const labels = useMemo(() => {
    const titles = splitFormList(form.jobTitles);
    const categories = splitFormList(form.jobCategories);
    const levels = [...form.experienceLevels];
    const types = [...form.jobTypes];
    const remote = [...form.locationTypes];
    const industries = splitFormList(form.industries);
    const dateLabel = form.datePostedWithinDays
      ? POSTED_WITHIN_OPTIONS.find((o) => String(o.days) === form.datePostedWithinDays)?.label ?? "Date posted"
      : "Date posted";
    return {
      countryLabel: locationCountryLabel(form),
      titlesLabel: multiValuePillLabel(titles, "Target roles"),
      categoriesLabel: multiValuePillLabel(categories, "Role categories"),
      levelsLabel: multiValuePillLabel(levels, "Seniority"),
      typesLabel: multiValuePillLabel(types, "Job type"),
      remoteLabel: multiValuePillLabel(remote, "Work mode"),
      dateLabel,
      industryLabel: industries.length ? multiValuePillLabel(industries, "Industry") : "Industry",
      yearsLabel: yearsExperienceLabel(form.yearsFrom, form.yearsTo),
    };
  }, [form]);

  const apply = (next: RecommendedFilterForm) => {
    setForm(next);
    onQuickApply(next);
    setOpenKey(null);
  };

  const applyBtn = () => (
    <button
      type="button"
      onClick={() => apply(form)}
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
  );

  const hasCountry =
    Boolean(form.locationCountry.trim()) ||
    Boolean(form.locationCity.trim()) ||
    Boolean(form.locationRegion.trim());
  const titles = splitFormList(form.jobTitles);
  const categories = splitFormList(form.jobCategories);
  const levels = [...form.experienceLevels];
  const types = [...form.jobTypes];
  const remote = [...form.locationTypes];

  return (
    <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, overflowX: "auto", flex: 1, minWidth: 0, WebkitOverflowScrolling: "touch" }}>
        {hasCountry ? (
          <ActiveFilterChip
            label={labels.countryLabel}
            onRemove={() =>
              apply({ ...form, locationCity: "", locationRegion: "", locationCountry: "", locationRadiusMiles: "" })
            }
          />
        ) : (
          <DropdownPill label={labels.countryLabel} open={openKey === "location"} onOpenChange={(o) => setOpenKey(o ? "location" : null)}>
            <PopoverSection title="Location">
              <FilterField label="City"><input style={pipelineInputStyle} value={form.locationCity} onChange={(e) => setForm((f) => ({ ...f, locationCity: e.target.value }))} placeholder="Albany" /></FilterField>
              <FilterField label="State / region"><DatalistInput value={form.locationRegion} onChange={(locationRegion) => setForm((f) => ({ ...f, locationRegion }))} listId="jobright-region" options={[...HIREBASE_FILTER_US_STATES]} placeholder="New York" /></FilterField>
              <FilterField label="Country"><DatalistInput value={form.locationCountry} onChange={(locationCountry) => setForm((f) => ({ ...f, locationCountry }))} listId="jobright-country" options={[...HIREBASE_FILTER_COUNTRIES]} placeholder="United States" /></FilterField>
              {applyBtn()}
            </PopoverSection>
          </DropdownPill>
        )}

        {titles.length > 0 ? (
          <ActiveFilterChip label={labels.titlesLabel} onRemove={() => apply({ ...form, jobTitles: "" })} />
        ) : null}

        {categories.length > 0 ? (
          <ActiveFilterChip label={labels.categoriesLabel} onRemove={() => apply({ ...form, jobCategories: "" })} />
        ) : (
          <DropdownPill label={labels.categoriesLabel} open={openKey === "categories"} onOpenChange={(o) => setOpenKey(o ? "categories" : null)}>
            <PopoverSection title="Role categories">
              <DatalistInput value={form.jobCategories} onChange={(jobCategories) => setForm((f) => ({ ...f, jobCategories }))} listId="jobright-categories" options={categorySuggestions ?? []} placeholder="Operations Jobs" />
              {applyBtn()}
            </PopoverSection>
          </DropdownPill>
        )}

        {levels.length > 0 ? (
          <ActiveFilterChip label={labels.levelsLabel} onRemove={() => apply({ ...form, experienceLevels: new Set() })} />
        ) : null}

        {types.length > 0 ? (
          <ActiveFilterChip label={labels.typesLabel} onRemove={() => apply({ ...form, jobTypes: new Set() })} />
        ) : null}

        {remote.length > 0 ? (
          <ActiveFilterChip label={labels.remoteLabel} onRemove={() => apply({ ...form, locationTypes: new Set() })} />
        ) : null}

        <DropdownPill label={labels.dateLabel} active={Boolean(form.datePostedWithinDays)} open={openKey === "date"} onOpenChange={(o) => setOpenKey(o ? "date" : null)}>
          <PopoverSection title="Date posted">
            <RadioOption label="Any time" checked={!form.datePostedWithinDays} onSelect={() => apply({ ...form, datePostedWithinDays: "" })} />
            {POSTED_WITHIN_OPTIONS.map((opt) => (
              <RadioOption key={opt.days} label={opt.label} checked={form.datePostedWithinDays === String(opt.days)} onSelect={() => apply({ ...form, datePostedWithinDays: String(opt.days) })} />
            ))}
          </PopoverSection>
        </DropdownPill>

        <DropdownPill label={labels.industryLabel} active={Boolean(form.industries.trim())} open={openKey === "industry"} onOpenChange={(o) => setOpenKey(o ? "industry" : null)}>
          <PopoverSection title="Industry">
            <input style={pipelineInputStyle} value={form.industries} onChange={(e) => setForm((f) => ({ ...f, industries: e.target.value }))} placeholder="Software, Healthcare" />
            {applyBtn()}
          </PopoverSection>
        </DropdownPill>

        <DropdownPill label={labels.yearsLabel} active={Boolean(form.yearsFrom.trim() || form.yearsTo.trim())} open={openKey === "years"} onOpenChange={(o) => setOpenKey(o ? "years" : null)}>
          <PopoverSection title="Years of experience">
            {YEARS_OF_EXPERIENCE_OPTIONS.map((opt) => (
              <RadioOption key={opt.label} label={opt.label} checked={form.yearsFrom === opt.yearsFrom && form.yearsTo === opt.yearsTo} onSelect={() => apply({ ...form, yearsFrom: opt.yearsFrom, yearsTo: opt.yearsTo })} />
            ))}
          </PopoverSection>
        </DropdownPill>

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
            background: activeFilterCount > 0 ? "rgba(45, 107, 74, 0.08)" : surface.card,
            color: activeFilterCount > 0 ? color.forest : color.ink,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: activeFilterCount > 0 ? 600 : 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          All Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {onSearchChange && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, width: isMobile ? "100%" : "auto" }}>
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
            style={{ ...pipelineInputStyle, width: isMobile ? "100%" : 220, margin: 0, padding: "7px 10px", fontSize: T.label }}
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
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
