"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HIREBASE_JOB_TYPES, HIREBASE_LOCATION_TYPES } from "@/lib/vector-matched-job";
import type { NetworkJobFilterForm, NetworkJobFilterSuggestions } from "@/lib/network-job-filters";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { BRUDDLE_BTN_CLASS, BRUDDLE_HOVER_LIFT_CLASS, scoutPrimaryCtaStyle } from "./scout-box";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import {
  ChipToggle,
  DatalistInput,
  FilterField,
  FilterSectionHeader,
  pipelineInputStyle,
} from "./pipeline-filters-ui";

const SALARY_QUICK_OPTIONS = [
  { value: "", label: "Any compensation" },
  { value: "80000", label: "$80,000+" },
  { value: "100000", label: "$100,000+" },
  { value: "120000", label: "$120,000+" },
  { value: "150000", label: "$150,000+" },
  { value: "200000", label: "$200,000+" },
  { value: "250000", label: "$250,000+" },
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
            border: active ? border.lineStrong : border.line,
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
        style={{ background: surface.card, border: border.line, borderRadius: "var(--scout-radius)" }}
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
        <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 10px", letterSpacing: "0.03em" }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function RadioOption({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontFamily: fontSans, fontSize: T.caption, color: color.ink, cursor: "pointer" }}>
      <input type="radio" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function locationQuickLabel(form: NetworkJobFilterForm): string {
  const parts = [form.locationCity, form.locationState].filter(Boolean);
  if (!parts.length) return "Location";
  return parts.join(", ");
}

function quickFilterLabels(form: NetworkJobFilterForm) {
  const workLabel = form.remoteOption.trim() || "Work arrangement";
  const titlesLabel = form.jobTitles.trim()
    ? form.jobTitles.split(/[,;|]/)[0]!.trim().slice(0, 24) + (form.jobTitles.includes(",") ? "…" : "")
    : "Job titles";
  const salaryOpt = SALARY_QUICK_OPTIONS.find((o) => o.value === form.salaryFrom);
  const salaryLabel =
    salaryOpt && salaryOpt.value ? salaryOpt.label : form.salaryFrom ? `$${Number(form.salaryFrom).toLocaleString()}+` : "Compensation";
  return { workLabel, titlesLabel, salaryLabel };
}

function AllFiltersDrawerContent({
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <FilterSectionHeader title="Where you want to work" hint="Optional — leave blank to see roles everywhere." />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 12, marginBottom: 14 }}>
        <FilterField label="City">
          <DatalistInput value={form.locationCity} onChange={(locationCity) => setForm((f) => ({ ...f, locationCity }))} listId="network-drawer-city" options={suggestions.cities} placeholder="Sacramento" />
        </FilterField>
        <FilterField label="State / region">
          <DatalistInput value={form.locationState} onChange={(locationState) => setForm((f) => ({ ...f, locationState }))} listId="network-drawer-state" options={suggestions.states} placeholder="California" />
        </FilterField>
      </div>
      <FilterField label="Work arrangement">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {HIREBASE_LOCATION_TYPES.map((t) => (
            <ChipToggle key={t} label={t} active={form.remoteOption.toLowerCase() === t.toLowerCase()} onClick={() => setForm((f) => ({ ...f, remoteOption: f.remoteOption.toLowerCase() === t.toLowerCase() ? "" : t }))} />
          ))}
        </div>
      </FilterField>
      <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
        <FilterSectionHeader title="Role focus" hint="Comma-separate multiple titles or keywords." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <FilterField label="Job titles">
          <input style={pipelineInputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="Product Manager, Attorney" />
        </FilterField>
        <FilterField label="Keywords">
          <input style={pipelineInputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="healthcare, SaaS, litigation" />
        </FilterField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12, marginTop: 16, paddingTop: 16, borderTop: border.line }}>
        <FilterField label="Compensation from ($)">
          <input type="number" style={pipelineInputStyle} value={form.salaryFrom} onChange={(e) => setForm((f) => ({ ...f, salaryFrom: e.target.value }))} placeholder="100000" min={0} />
        </FilterField>
        <FilterField label="Compensation to ($)">
          <input type="number" style={pipelineInputStyle} value={form.salaryTo} onChange={(e) => setForm((f) => ({ ...f, salaryTo: e.target.value }))} placeholder="250000" min={0} />
        </FilterField>
        <FilterField label="Employment type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HIREBASE_JOB_TYPES.slice(0, 4).map((t) => (
              <ChipToggle key={t} label={t} active={form.jobType.toLowerCase() === t.toLowerCase()} onClick={() => setForm((f) => ({ ...f, jobType: f.jobType.toLowerCase() === t.toLowerCase() ? "" : t }))} />
            ))}
          </div>
        </FilterField>
      </div>
      {internalView && (
        <>
          <div style={{ borderTop: border.line, margin: "16px 0", paddingTop: 16 }}>
            <FilterSectionHeader title="Staff filters" hint="Internal-only — fees, channel, and agency fields." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
            <FilterField label="Company">
              <DatalistInput value={form.companyName} onChange={(companyName) => setForm((f) => ({ ...f, companyName }))} listId="network-drawer-company" options={suggestions.companies} placeholder="Employer name" />
            </FilterField>
            <FilterField label="Industries">
              <DatalistInput value={form.industries} onChange={(industries) => setForm((f) => ({ ...f, industries }))} listId="network-drawer-industry" options={suggestions.industries} placeholder="Healthcare, Software" />
            </FilterField>
            <FilterField label="Channel">
              <select style={pipelineInputStyle} value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                <option value="">All channels</option>
                <option value="TE">TE</option>
                <option value="ET">ET</option>
              </select>
            </FilterField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
            <FilterField label="Shared after">
              <input type="date" style={pipelineInputStyle} value={form.sharedAfter} onChange={(e) => setForm((f) => ({ ...f, sharedAfter: e.target.value }))} />
            </FilterField>
            <FilterField label="Recruiting agency">
              <DatalistInput value={form.agencyName} onChange={(agencyName) => setForm((f) => ({ ...f, agencyName }))} listId="network-drawer-agency" options={suggestions.agencies} placeholder="Agency name" />
            </FilterField>
            <FilterField label="Network status">
              <DatalistInput value={form.networkStatus} onChange={(networkStatus) => setForm((f) => ({ ...f, networkStatus }))} listId="network-drawer-status" options={suggestions.statuses} placeholder="Active, On hold" />
            </FilterField>
            <FilterField label="Placement fee">
              <input style={pipelineInputStyle} value={form.feeQuery} onChange={(e) => setForm((f) => ({ ...f, feeQuery: e.target.value }))} placeholder="20%, flat fee" />
            </FilterField>
            <FilterField label="Fee type">
              <DatalistInput value={form.feeType} onChange={(feeType) => setForm((f) => ({ ...f, feeType }))} listId="network-drawer-fee-type" options={suggestions.feeTypes} placeholder="percentage, flat" />
            </FilterField>
            <FilterField label="Guarantee">
              <DatalistInput value={form.guaranteeQuery} onChange={(guaranteeQuery) => setForm((f) => ({ ...f, guaranteeQuery }))} listId="network-drawer-guarantee" options={suggestions.guarantees} placeholder="90 days" />
            </FilterField>
          </div>
        </>
      )}
    </div>
  );
}

export function NetworkFiltersDrawer({
  open,
  onClose,
  form,
  setForm,
  suggestions,
  internalView,
  onApply,
  onReset,
  applying,
}: {
  open: boolean;
  onClose: () => void;
  form: NetworkJobFilterForm;
  setForm: React.Dispatch<React.SetStateAction<NetworkJobFilterForm>>;
  suggestions: NetworkJobFilterSuggestions;
  internalView: boolean;
  onApply: () => void;
  onReset: () => void;
  applying?: boolean;
}) {
  const { backdropStyle, panelStyle } = useWorkspaceDrawerLayout({ inset: 0 });
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
      <div role="presentation" onClick={onClose} style={{ ...backdropStyle, background: "rgba(0,0,0,0.35)", zIndex: DRAWER_BACKDROP_Z }} />
      <div role="dialog" aria-modal="true" aria-label="All filters" style={{ ...panelStyle, width: "min(480px, 100vw)", background: surface.card, borderLeft: border.line, zIndex: DRAWER_Z, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: border.line, flexShrink: 0 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink, margin: 0 }}>All filters</p>
          <button type="button" onClick={onClose} aria-label="Close filters" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: color.muted, display: "flex" }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          <AllFiltersDrawerContent form={form} setForm={setForm} suggestions={suggestions} internalView={internalView} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderTop: border.line, flexShrink: 0, background: surface.card }}>
          <button type="button" onClick={onReset} style={{ border: "none", background: "transparent", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
          <button type="button" className={BRUDDLE_BTN_CLASS} onClick={onApply} disabled={applying} style={{ padding: "10px 20px", border: "var(--scout-border)", borderRadius: "var(--scout-radius)", ...scoutPrimaryCtaStyle, fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, cursor: applying ? "default" : "pointer", opacity: applying ? 0.7 : 1 }}>
            {applying ? "Loading…" : "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}

export function NetworkQuickFiltersBar({
  form,
  setForm,
  suggestions,
  internalView,
  onQuickApply,
  onOpenAllFilters,
  activeFilterCount,
}: {
  form: NetworkJobFilterForm;
  setForm: React.Dispatch<React.SetStateAction<NetworkJobFilterForm>>;
  suggestions: NetworkJobFilterSuggestions;
  internalView: boolean;
  onQuickApply: (nextForm: NetworkJobFilterForm) => void;
  onOpenAllFilters: () => void;
  activeFilterCount: number;
}) {
  const labels = useMemo(() => quickFilterLabels(form), [form]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const applyAndClose = (next: NetworkJobFilterForm, key: string) => {
    setForm(next);
    onQuickApply(next);
    setOpenKey(null);
  };
  const applyBtn = (key: string) => (
    <button type="button" className={BRUDDLE_BTN_CLASS} onClick={() => applyAndClose(form, key)} style={{ marginTop: 10, width: "100%", padding: "8px 12px", border: "var(--scout-border)", borderRadius: "var(--scout-radius)", ...scoutPrimaryCtaStyle, fontFamily: fontSans, fontSize: T.label, fontWeight: 600, cursor: "pointer" }}>
      Apply
    </button>
  );
  return (
    <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
      <FilterPill label={locationQuickLabel(form)} active={Boolean(form.locationCity.trim() || form.locationState.trim())} open={openKey === "location"} onOpenChange={(o) => setOpenKey(o ? "location" : null)}>
        <PopoverSection title="Location">
          <FilterField label="City"><DatalistInput value={form.locationCity} onChange={(locationCity) => setForm((f) => ({ ...f, locationCity }))} listId="network-quick-city" options={suggestions.cities} placeholder="Sacramento" /></FilterField>
          <FilterField label="State / region"><DatalistInput value={form.locationState} onChange={(locationState) => setForm((f) => ({ ...f, locationState }))} listId="network-quick-state" options={suggestions.states} placeholder="California" /></FilterField>
          {applyBtn("location")}
        </PopoverSection>
      </FilterPill>
      <FilterPill label={labels.workLabel} active={Boolean(form.remoteOption.trim())} open={openKey === "work"} onOpenChange={(o) => setOpenKey(o ? "work" : null)}>
        <PopoverSection title="Work arrangement">
          <RadioOption label="Any" checked={!form.remoteOption.trim()} onSelect={() => applyAndClose({ ...form, remoteOption: "" }, "work")} />
          {HIREBASE_LOCATION_TYPES.map((type) => (
            <RadioOption key={type} label={type} checked={form.remoteOption.toLowerCase() === type.toLowerCase()} onSelect={() => applyAndClose({ ...form, remoteOption: type }, "work")} />
          ))}
        </PopoverSection>
      </FilterPill>
      <FilterPill label={labels.titlesLabel} active={Boolean(form.jobTitles.trim() || form.keywords.trim())} open={openKey === "role"} onOpenChange={(o) => setOpenKey(o ? "role" : null)}>
        <PopoverSection title="Role focus">
          <FilterField label="Job titles"><input style={pipelineInputStyle} value={form.jobTitles} onChange={(e) => setForm((f) => ({ ...f, jobTitles: e.target.value }))} placeholder="VP Product, Attorney" /></FilterField>
          <FilterField label="Keywords"><input style={pipelineInputStyle} value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="healthcare, SaaS" /></FilterField>
          {applyBtn("role")}
        </PopoverSection>
      </FilterPill>
      <FilterPill label={labels.salaryLabel} active={Boolean(form.salaryFrom.trim())} open={openKey === "salary"} onOpenChange={(o) => setOpenKey(o ? "salary" : null)}>
        <PopoverSection title="Compensation">
          {SALARY_QUICK_OPTIONS.map((opt) => (
            <RadioOption key={opt.value || "any"} label={opt.label} checked={form.salaryFrom === opt.value} onSelect={() => applyAndClose({ ...form, salaryFrom: opt.value }, "salary")} />
          ))}
        </PopoverSection>
      </FilterPill>
      {internalView && (
        <FilterPill label={form.channel.trim() ? form.channel.trim() : "Channel"} active={Boolean(form.channel.trim())} open={openKey === "channel"} onOpenChange={(o) => setOpenKey(o ? "channel" : null)}>
          <PopoverSection title="Channel">
            <RadioOption label="All channels" checked={!form.channel.trim()} onSelect={() => applyAndClose({ ...form, channel: "" }, "channel")} />
            <RadioOption label="TE" checked={form.channel === "TE"} onSelect={() => applyAndClose({ ...form, channel: "TE" }, "channel")} />
            <RadioOption label="ET" checked={form.channel === "ET"} onSelect={() => applyAndClose({ ...form, channel: "ET" }, "channel")} />
          </PopoverSection>
        </FilterPill>
      )}
      <div style={{ width: 1, height: 24, background: "rgba(17,17,17,0.14)", margin: "0 2px" }} aria-hidden />
      <button type="button" className={BRUDDLE_HOVER_LIFT_CLASS} onClick={onOpenAllFilters} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: "var(--scout-radius)", border: activeFilterCount > 0 ? border.lineStrong : border.line, background: activeFilterCount > 0 ? surface.inset : surface.card, color: activeFilterCount > 0 ? color.forest : color.ink, fontFamily: fontSans, fontSize: T.caption, fontWeight: activeFilterCount > 0 ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>
        All filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
    </div>
  );
}
