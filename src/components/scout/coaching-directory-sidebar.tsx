"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyLogo } from "@/components/scout/company-logo";
import { COACH_CLIENT_SPECIALIZATIONS, COACH_RATE_BUCKETS } from "@/lib/coach-categories";
import { coachCompanyNameForSlug } from "@/lib/coach-companies";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type OrgSuggestItem = {
  catalogSlug: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  source?: string;
};

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

function CoachCompanyFilter({
  allCoaches,
  selectedSlug,
  onSelect,
}: {
  allCoaches: CoachListItem[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<OrgSuggestItem[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedName = useMemo(() => {
    if (!selectedSlug) return "";
    return coachCompanyNameForSlug(allCoaches, selectedSlug) ?? selectedSlug;
  }, [allCoaches, selectedSlug]);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/coaches/companies/suggest?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as OrgSuggestItem[];
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {selectedSlug ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            border: border.line,
            background: "rgba(26,58,47,0.06)",
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest }}>{selectedName}</span>
          <button
            type="button"
            onClick={() => onSelect("")}
            style={{
              background: "none",
              border: "none",
              fontFamily: fontSans,
              fontSize: 12,
              color: color.muted,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
      <input
        type="search"
        placeholder="Search coach companies…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        style={{ ...inputStyle, marginBottom: 0 }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 20,
            background: surface.card,
            border: border.line,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {searching ? (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, padding: "10px 12px", margin: 0 }}>Searching…</p>
          ) : suggestions.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, padding: "10px 12px", margin: 0 }}>
              No coach companies match.
            </p>
          ) : (
            suggestions.map((item) => {
              const active = selectedSlug === item.catalogSlug;
              return (
                <button
                  key={item.catalogSlug}
                  type="button"
                  onClick={() => {
                    onSelect(active ? "" : item.catalogSlug);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: border.line,
                    background: active ? "rgba(26,58,47,0.08)" : surface.card,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <CompanyLogo name={item.name} logoUrl={item.logoUrl} website={item.website} size={28} />
                  <span style={{ fontFamily: fontSans, fontSize: 13, color: color.ink, fontWeight: active ? 600 : 400 }}>
                    {item.name}
                  </span>
                  {item.source === "hirebase" && (
                    <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, marginLeft: "auto" }}>Hirebase</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
      {!open && !selectedSlug && suggestions.length === 0 && (
        <p style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, margin: "8px 0 0", lineHeight: 1.4 }}>
          Companies from coach profiles — search uses Hirebase lookup.
        </p>
      )}
    </div>
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
  const [serviceSearch, setServiceSearch] = useState("");

  const allSpecialties = useMemo(() => Array.from(new Set(allCoaches.flatMap((c) => c.specialties))).sort(), [allCoaches]);

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
        <CoachCompanyFilter
          allCoaches={allCoaches}
          selectedSlug={filters.firm}
          onSelect={(slug) => onChange("firm", slug)}
        />
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
