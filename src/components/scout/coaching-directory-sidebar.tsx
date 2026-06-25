"use client";

import { useMemo, useState } from "react";
import { COACH_CLIENT_SPECIALIZATIONS, COACH_RATE_BUCKETS } from "@/lib/coach-categories";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  borderRadius: 0,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

type FilterValues = {
  rateMin: string;
  rateMax: string;
  firm: string;
  specialty: string;
  specialization: string;
  professional: boolean;
};

type Props = {
  allCoaches: CoachListItem[];
  filters: FilterValues;
  onChange: (key: string, value: string) => void;
  onBatchChange: (patch: Record<string, string>) => void;
  onProfessionalChange: (checked: boolean) => void;
  onClear: () => void;
  activeCount: number;
};

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: border.line, paddingBottom: 14, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: "0 0 10px",
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: 13,
          fontWeight: 700,
          color: color.ink,
        }}
      >
        {title}
        <span style={{ color: color.muted, fontSize: 12 }}>{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}

function CheckRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
        cursor: "pointer",
        fontFamily: fontSans,
        fontSize: 13,
        color: color.stone,
        lineHeight: 1.4,
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: color.forest }} />
      <span>{label}</span>
    </label>
  );
}

export function CoachingDirectorySidebar({
  allCoaches,
  filters,
  onChange,
  onBatchChange,
  onProfessionalChange,
  onClear,
  activeCount,
}: Props) {
  const [companySearch, setCompanySearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  const allFirms = useMemo(
    () =>
      Array.from(
        new Set(
          allCoaches.flatMap((c) => [...c.firms, c.currentCompany].filter(Boolean) as string[]),
        ),
      ).sort(),
    [allCoaches],
  );
  const allSpecialties = useMemo(() => Array.from(new Set(allCoaches.flatMap((c) => c.specialties))).sort(), [allCoaches]);

  const filteredFirms = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return allFirms.slice(0, 12);
    return allFirms.filter((f) => f.toLowerCase().includes(q)).slice(0, 12);
  }, [allFirms, companySearch]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return allSpecialties.slice(0, 14);
    return allSpecialties.filter((s) => s.toLowerCase().includes(q)).slice(0, 14);
  }, [allSpecialties, serviceSearch]);

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: surface.card,
        border: border.line,
        padding: "18px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 700, color: color.ink, margin: 0 }}>Filters</p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{
              background: "none",
              border: "none",
              fontFamily: fontSans,
              fontSize: 12,
              fontWeight: 600,
              color: color.forest,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      <FilterSection title="Hourly rate">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            placeholder="Min"
            value={filters.rateMin}
            onChange={(e) => onChange("rateMin", e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.rateMax}
            onChange={(e) => onChange("rateMax", e.target.value)}
            style={inputStyle}
          />
        </div>
        {COACH_RATE_BUCKETS.map((b) => {
          const active =
            filters.rateMin === String(b.min) && (b.max == null ? !filters.rateMax : filters.rateMax === String(b.max));
          return (
            <CheckRow
              key={b.label}
              checked={active}
              label={b.label}
              onChange={() => onBatchChange({ rateMin: String(b.min), rateMax: b.max != null ? String(b.max) : "" })}
            />
          );
        })}
      </FilterSection>

      <FilterSection title="Companies">
        <input
          type="search"
          placeholder="Search companies…"
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        {filteredFirms.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>No companies match.</p>
        ) : (
          filteredFirms.map((firm) => (
            <CheckRow
              key={firm}
              checked={filters.firm === firm}
              label={firm}
              onChange={() => onChange("firm", filters.firm === firm ? "" : firm)}
            />
          ))
        )}
      </FilterSection>

      <FilterSection title="Specialized experience">
        <CheckRow
          checked={filters.professional}
          label="Professional coach"
          onChange={() => onProfessionalChange(!filters.professional)}
        />
        {COACH_CLIENT_SPECIALIZATIONS.map((spec) => (
          <CheckRow
            key={spec}
            checked={filters.specialization === spec}
            label={spec}
            onChange={() => onChange("specialization", filters.specialization === spec ? "" : spec)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Services offered">
        <input
          type="search"
          placeholder="Search services…"
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        {filteredServices.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>No services match.</p>
        ) : (
          filteredServices.map((s) => (
            <CheckRow
              key={s}
              checked={filters.specialty === s}
              label={s}
              onChange={() => onChange("specialty", filters.specialty === s ? "" : s)}
            />
          ))
        )}
      </FilterSection>
    </aside>
  );
}
