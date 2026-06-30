"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { describeActiveFilters } from "@/lib/recommended-filter-utils";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import {
  ALL_FILTER_SECTIONS,
  AllFiltersScrollContent,
  type AllFiltersSectionId,
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";
import { jobFunctionPillItems } from "./job-function-dropdown";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";

const DRAWER_WIDTH = "clamp(480px, 62vw, 900px)";

function modalSummaryTitle(appliedForm: RecommendedFilterForm): string {
  const parts: string[] = [];
  const jobFns = jobFunctionPillItems(appliedForm);
  if (jobFns.length) parts.push(jobFns.slice(0, 2).join(", "));
  if (appliedForm.locationAllInCountry && appliedForm.locationCountry.trim()) {
    parts.push(
      appliedForm.locationCountry === "United States"
        ? "Anywhere in the US"
        : appliedForm.locationCountry === "Canada"
          ? "Anywhere in Canada"
          : appliedForm.locationCountry.trim(),
    );
  } else if (appliedForm.locationCity.trim()) {
    parts.push(appliedForm.locationCity.trim());
  } else if (appliedForm.locationCountry.trim()) {
    parts.push(appliedForm.locationCountry.trim());
  }
  if (!parts.length) return "All Filters";
  const extra = jobFns.length > 2 ? ` + ${jobFns.length - 2} roles` : "";
  return `${parts[0]}${extra}`;
}

function activeChipLabels(filters: VectorSearchFilters): string[] {
  return describeActiveFilters(filters).map((label) => {
    const colon = label.indexOf(":");
    return colon >= 0 ? label.slice(colon + 1).trim() : label;
  });
}

export function OpportunitiesAllFiltersModal({
  open,
  onClose,
  form,
  appliedForm,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
  onConfirm,
  applying,
  appliedFilters,
}: {
  open: boolean;
  onClose: () => void;
  form: RecommendedFilterForm;
  /** Applied filters — drives drawer title and header chips (form is the edit draft). */
  appliedForm: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
  onConfirm: () => void;
  applying?: boolean;
  appliedFilters: VectorSearchFilters;
}) {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<AllFiltersSectionId>("basic");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<AllFiltersSectionId, HTMLElement | null>>>({});

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveSection("basic");
    scrollRef.current?.scrollTo({ top: 0 });
  }, [open]);

  useEffect(() => {
    if (!open || isMobile) return;
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        const top = visible[0]?.target.getAttribute("data-section-id") as AllFiltersSectionId | null;
        if (top) setActiveSection(top);
      },
      { root, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.4] },
    );

    for (const section of ALL_FILTER_SECTIONS) {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [open, isMobile]);

  const scrollToSection = useCallback((id: AllFiltersSectionId) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const chips = useMemo(() => activeChipLabels(appliedFilters), [appliedFilters]);
  const visibleChips = chips.slice(0, 6);
  const overflowCount = chips.length - visibleChips.length;

  if (!open) return null;

  const drawerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "auto",
        maxHeight: "92vh",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
      }
    : {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        boxShadow: "-8px 0 40px rgba(0,0,0,0.14)",
      };

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: DRAWER_BACKDROP_Z,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
        style={{
          ...drawerStyle,
          zIndex: DRAWER_Z,
          display: "flex",
          flexDirection: "column",
          background: surface.card,
        }}
      >
        {isMobile && (
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              paddingTop: 10,
              paddingBottom: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: "rgba(17,17,17,0.18)",
              }}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: isMobile ? "12px 14px" : "16px 20px",
            borderBottom: border.line,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: border.line,
              borderRadius: 8,
              background: surface.card,
              cursor: "pointer",
              color: color.ink,
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.body,
              fontWeight: 700,
              color: color.ink,
              margin: 0,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {modalSummaryTitle(appliedForm)}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying}
            style={{
              padding: "9px 22px",
              border: "none",
              borderRadius: 999,
              background: color.forest,
              color: color.gold,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 700,
              cursor: applying ? "default" : "pointer",
              opacity: applying ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {applying ? "Loading…" : "Confirm"}
          </button>
        </div>

        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderBottom: border.line,
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            {visibleChips.map((chip) => (
              <span
                key={chip}
                style={{
                  display: "inline-flex",
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: surface.inset,
                  border: border.line,
                  fontFamily: fontSans,
                  fontSize: T.label,
                  color: color.ink,
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </span>
            ))}
            {overflowCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "rgba(45, 107, 74, 0.12)",
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  color: color.forest,
                  whiteSpace: "nowrap",
                }}
              >
                +{overflowCount} Filters
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {!isMobile && (
            <aside
              style={{
                width: 220,
                flexShrink: 0,
                borderRight: border.line,
                display: "flex",
                flexDirection: "column",
                background: surface.inset,
              }}
            >
              <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {ALL_FILTER_SECTIONS.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "14px 16px",
                        border: "none",
                        background: active ? "rgba(17,17,17,0.06)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontFamily: fontSans,
                          fontSize: T.caption,
                          fontWeight: active ? 700 : 600,
                          color: color.ink,
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontFamily: fontSans,
                          fontSize: T.label,
                          color: color.muted,
                          marginTop: 4,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.hint}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div
                style={{
                  margin: "12px",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(45, 107, 74, 0.1)",
                  border: "1px solid rgba(45, 107, 74, 0.22)",
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    fontFamily: fontSans,
                    fontSize: T.label,
                    color: color.forest,
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Applying for specific companies? Use filters in the Company Insights section to find your target
                  companies.
                </p>
              </div>
            </aside>
          )}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {isMobile && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  padding: "8px 14px 0",
                  flexShrink: 0,
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {ALL_FILTER_SECTIONS.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      style={{
                        flexShrink: 0,
                        padding: "7px 12px",
                        borderRadius: 999,
                        border: active ? "1px solid rgba(45, 107, 74, 0.35)" : border.line,
                        background: active ? "rgba(45, 107, 74, 0.12)" : surface.card,
                        fontFamily: fontSans,
                        fontSize: T.label,
                        fontWeight: active ? 700 : 500,
                        color: active ? color.forest : color.ink,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            )}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "12px 14px 28px" : "24px 28px 36px",
              }}
            >
              <AllFiltersScrollContent
                form={form}
                setForm={setForm}
                toggleSet={toggleSet}
                trackedCompanyNames={trackedCompanyNames}
                categorySuggestions={categorySuggestions}
                sectionRefs={sectionRefs}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
