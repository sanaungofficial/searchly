"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompanyLogo } from "@/components/scout/company-logo";
import { COACH_CLIENT_SPECIALIZATIONS, COACH_RATE_BUCKETS } from "@/lib/coach-categories";
import { coachCompanyNameForSlug } from "@/lib/coach-companies";
import type { CoachListItem } from "@/lib/coach-types";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type OrgSuggestItem = {
  catalogSlug: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
};

type FilterValues = {
  rateMin: string;
  rateMax: string;
  firm: string;
  specialty: string;
  specialization: string;
  professional: boolean;
  internal: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

function FilterPill({
  label, active, open, onOpenChange, children,
}: {
  label: string; active?: boolean; open?: boolean;
  onOpenChange?: (open: boolean) => void; children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "6px 12px", borderRadius: "var(--scout-radius)",
            border: active ? "var(--scout-border)" : "var(--scout-border)",
            background: active ? surface.inset : surface.card,
            color: active ? color.forest : color.ink,
            fontFamily: fontSans, fontSize: T.caption,
            fontWeight: active ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {label}
          <ChevronDown size={14} style={{ opacity: 0.65, flexShrink: 0 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start" sideOffset={6}
        className="w-auto min-w-[220px] max-w-[320px] p-0 shadow-lg"
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
        <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 10px", letterSpacing: "0.03em" }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "var(--scout-border)", paddingBottom: 16, marginBottom: 16 }}>
      <p style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 700, color: color.forest, margin: "0 0 10px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, cursor: "pointer", fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.4 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: color.forest }} />
      <span>{label}</span>
    </label>
  );
}

function CompanySearch({
  allCoaches, selectedSlug, onSelect, compact,
}: {
  allCoaches: CoachListItem[]; selectedSlug: string;
  onSelect: (slug: string) => void; compact?: boolean;
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
        setSuggestions(res.ok ? ((await res.json()) as OrgSuggestItem[]) : []);
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
      {selectedSlug && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", border: "var(--scout-border)", background: "rgba(26,58,47,0.06)", marginBottom: 6 }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest }}>{selectedName}</span>
          <button type="button" onClick={() => onSelect("")} style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: 11, color: color.muted, cursor: "pointer", padding: 0 }}>Clear</button>
        </div>
      )}
      <input
        type="search" placeholder="Search companies..." value={query}
        onChange={(e) => setQuery(e.target.value)} onFocus={() => setOpen(true)}
        style={{ ...inputStyle, ...(compact ? { fontSize: 12, padding: "6px 10px" } : {}) }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: surface.card, border: "var(--scout-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {searching ? (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, padding: "8px 12px", margin: 0 }}>Searching...</p>
          ) : suggestions.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, padding: "8px 12px", margin: 0 }}>No companies match.</p>
          ) : (
            suggestions.map((item) => {
              const isActive = selectedSlug === item.catalogSlug;
              return (
                <button
                  key={item.catalogSlug} type="button"
                  onClick={() => { onSelect(isActive ? "" : item.catalogSlug); setOpen(false); setQuery(""); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "none", borderBottom: "var(--scout-border)", background: isActive ? "rgba(26,58,47,0.08)" : surface.card, cursor: "pointer", textAlign: "left" }}
                >
                  <CompanyLogo name={item.name} logoUrl={item.logoUrl} website={item.website} size={24} />
                  <span style={{ fontFamily: fontSans, fontSize: 12, color: color.ink, fontWeight: isActive ? 600 : 400 }}>{item.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function rateLabel(rateMin: string, rateMax: string): string {
  if (!rateMin && !rateMax) return "Rate";
  const bucket = COACH_RATE_BUCKETS.find(
    (b) => String(b.min) === rateMin && (b.max == null ? !rateMax : String(b.max) === rateMax),
  );
  if (bucket) return bucket.label;
  if (rateMin && rateMax) return `$${rateMin}-$${rateMax}/hr`;
  if (rateMin) return `$${rateMin}+/hr`;
  return `Up to $${rateMax}/hr`;
}

type QuickFiltersBarProps = {
  allCoaches: CoachListItem[];
  filters: FilterValues;
  activeCount: number;
  onChange: (key: string, value: string) => void;
  onBatchChange: (patch: Record<string, string>) => void;
  onInternalChange: (v: boolean) => void;
  onOpenAllFilters: () => void;
};

export function CoachQuickFiltersBar({
  allCoaches, filters, activeCount, onChange, onBatchChange, onInternalChange, onOpenAllFilters,
}: QuickFiltersBarProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const kimchiCount = useMemo(() => allCoaches.filter((c) => c.isInternal).length, [allCoaches]);
  const rateLbl = rateLabel(filters.rateMin, filters.rateMax);
  const firmName = useMemo(() => {
    if (!filters.firm) return null;
    return coachCompanyNameForSlug(allCoaches, filters.firm) ?? filters.firm;
  }, [allCoaches, filters.firm]);
  const specLabel = filters.specialization || "Specialization";

  return (
    <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
      <FilterPill label={rateLbl} active={Boolean(filters.rateMin || filters.rateMax)} open={openKey === "rate"} onOpenChange={(o) => setOpenKey(o ? "rate" : null)}>
        <PopoverSection title="Hourly rate">
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input type="number" placeholder="Min" value={filters.rateMin} onChange={(e) => onChange("rateMin", e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "6px 8px" }} />
            <input type="number" placeholder="Max" value={filters.rateMax} onChange={(e) => onChange("rateMax", e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "6px 8px" }} />
          </div>
          {COACH_RATE_BUCKETS.map((b) => {
            const isActive = filters.rateMin === String(b.min) && (b.max == null ? !filters.rateMax : filters.rateMax === String(b.max));
            return <CheckRow key={b.label} checked={isActive} label={b.label} onChange={() => { onBatchChange({ rateMin: String(b.min), rateMax: b.max != null ? String(b.max) : "" }); setOpenKey(null); }} />;
          })}
        </PopoverSection>
      </FilterPill>

      <FilterPill label={firmName ?? "Company"} active={Boolean(filters.firm)} open={openKey === "firm"} onOpenChange={(o) => setOpenKey(o ? "firm" : null)}>
        <PopoverSection title="Company">
          <CompanySearch allCoaches={allCoaches} selectedSlug={filters.firm} onSelect={(slug) => { onChange("firm", slug); if (slug) setOpenKey(null); }} compact />
        </PopoverSection>
      </FilterPill>

      <FilterPill label={specLabel} active={Boolean(filters.specialization)} open={openKey === "specialization"} onOpenChange={(o) => setOpenKey(o ? "specialization" : null)}>
        <PopoverSection title="Specialization">
          {COACH_CLIENT_SPECIALIZATIONS.map((spec) => (
            <CheckRow key={spec} checked={filters.specialization === spec} label={spec} onChange={() => { onChange("specialization", filters.specialization === spec ? "" : spec); setOpenKey(null); }} />
          ))}
        </PopoverSection>
      </FilterPill>

      {kimchiCount > 0 && (
        <button
          type="button" onClick={() => onInternalChange(!filters.internal)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: "var(--scout-radius)",
            border: filters.internal ? "var(--scout-border)" : "var(--scout-border)",
            background: filters.internal ? surface.inset : surface.card,
            color: filters.internal ? color.forest : color.ink,
            fontFamily: fontSans, fontSize: T.caption, fontWeight: filters.internal ? 600 : 500,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          Second Ladder team
        </button>
      )}

      <div style={{ width: 1, height: 22, background: "var(--scout-border)", flexShrink: 0 }} />

      <button
        type="button" onClick={onOpenAllFilters}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--scout-radius)",
          border: activeCount > 0 ? "var(--scout-border)" : "var(--scout-border)",
          background: activeCount > 0 ? surface.inset : surface.card,
          color: activeCount > 0 ? color.forest : color.ink,
          fontFamily: fontSans, fontSize: T.caption, fontWeight: activeCount > 0 ? 600 : 500,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <SlidersHorizontal size={13} style={{ flexShrink: 0 }} />
        {activeCount > 0 ? `All filters (${activeCount})` : "All filters"}
      </button>
    </div>
  );
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  allCoaches: CoachListItem[];
  filters: FilterValues;
  activeCount: number;
  onChange: (key: string, value: string) => void;
  onBatchChange: (patch: Record<string, string>) => void;
  onProfessionalChange: (v: boolean) => void;
  onInternalChange: (v: boolean) => void;
  onClear: () => void;
};

export function CoachFiltersDrawer({
  open, onClose, allCoaches, filters, activeCount, onChange, onBatchChange, onProfessionalChange, onInternalChange, onClear,
}: DrawerProps) {
  const { backdropStyle, panelStyle } = useWorkspaceDrawerLayout({ inset: 0 });
  const [serviceSearch, setServiceSearch] = useState("");
  const kimchiCount = useMemo(() => allCoaches.filter((c) => c.isInternal).length, [allCoaches]);
  const allSpecialties = useMemo(() => Array.from(new Set(allCoaches.flatMap((c) => c.specialties))).sort(), [allCoaches]);
  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return allSpecialties.slice(0, 14);
    return allSpecialties.filter((s) => s.toLowerCase().includes(q)).slice(0, 14);
  }, [allSpecialties, serviceSearch]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ ...backdropStyle, background: "rgba(0,0,0,0.35)", zIndex: DRAWER_BACKDROP_Z }} />
      <div style={{ ...panelStyle, width: "min(480px, 100vw)", background: surface.card, borderLeft: "var(--scout-border)", zIndex: DRAWER_Z, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "var(--scout-border)", flexShrink: 0 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink, margin: 0 }}>All filters</p>
          <button type="button" onClick={onClose} aria-label="Close filters" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: color.muted, display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {kimchiCount > 0 && (
            <DrawerSection title="Second Ladder team">
              <CheckRow checked={filters.internal} label={`Second Ladder coaches (${kimchiCount})`} onChange={() => onInternalChange(!filters.internal)} />
            </DrawerSection>
          )}

          <DrawerSection title="Hourly rate">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input type="number" placeholder="Min" value={filters.rateMin} onChange={(e) => onChange("rateMin", e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Max" value={filters.rateMax} onChange={(e) => onChange("rateMax", e.target.value)} style={inputStyle} />
            </div>
            {COACH_RATE_BUCKETS.map((b) => {
              const isActive = filters.rateMin === String(b.min) && (b.max == null ? !filters.rateMax : filters.rateMax === String(b.max));
              return <CheckRow key={b.label} checked={isActive} label={b.label} onChange={() => onBatchChange({ rateMin: String(b.min), rateMax: b.max != null ? String(b.max) : "" })} />;
            })}
          </DrawerSection>

          <DrawerSection title="Company">
            <CompanySearch allCoaches={allCoaches} selectedSlug={filters.firm} onSelect={(slug) => onChange("firm", slug)} />
          </DrawerSection>

          <DrawerSection title="Specialization">
            <CheckRow checked={filters.professional} label="Professional coach" onChange={() => onProfessionalChange(!filters.professional)} />
            {COACH_CLIENT_SPECIALIZATIONS.map((spec) => (
              <CheckRow key={spec} checked={filters.specialization === spec} label={spec} onChange={() => onChange("specialization", filters.specialization === spec ? "" : spec)} />
            ))}
          </DrawerSection>

          <DrawerSection title="Services offered">
            <input type="search" placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            {filteredServices.length === 0 ? (
              <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>No services match.</p>
            ) : (
              filteredServices.map((s) => (
                <CheckRow key={s} checked={filters.specialty === s} label={s} onChange={() => onChange("specialty", filters.specialty === s ? "" : s)} />
              ))
            )}
          </DrawerSection>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderTop: "var(--scout-border)", flexShrink: 0, background: surface.card }}>
          <button type="button" onClick={() => { onClear(); onClose(); }} style={{ border: "none", background: "transparent", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, cursor: "pointer", textDecoration: "underline" }}>
            Reset
          </button>
          <button type="button" className={BRUDDLE_BTN_CLASS} onClick={onClose} style={{ padding: "10px 20px", border: "var(--scout-border)", borderRadius: "var(--scout-radius)", background: color.cta, color: color.ctaForeground, boxShadow: "var(--scout-shadow-bruddle)", fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, cursor: "pointer" }}>
            Show results
          </button>
        </div>
      </div>
    </>
  );
}
