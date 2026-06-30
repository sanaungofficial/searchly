"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  buildOpportunitiesFilterChips,
  clearOpportunitiesFilterSection,
  opportunitiesDrawerTitle,
  removeOpportunitiesFilterChip,
  resetOpportunitiesFilterForm,
} from "@/lib/opportunities-filter-chips";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { BRUDDLE_BTN_CLASS, scoutPrimaryCtaStyle } from "./scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import { TOP_NAV_HEIGHT, TOP_NAV_HEIGHT_MOBILE } from "./workspace-top-nav";
import {
  ALL_FILTER_SECTIONS,
  AllFiltersScrollContent,
  type AllFiltersSectionId,
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";

const DRAWER_WIDTH = "clamp(480px, 62vw, 900px)";

export function OpportunitiesAllFiltersModal({
  open,
  onClose,
  form,
  appliedForm: _appliedForm,
  setForm,
  toggleSet,
  trackedCompanyNames,
  categorySuggestions,
  onConfirm,
  applying,
  onResetAll,
  excludeTargetRoleBleed,
}: {
  open: boolean;
  onClose: () => void;
  form: RecommendedFilterForm;
  /** Applied filters — used to detect whether draft differs from applied. */
  appliedForm: RecommendedFilterForm;
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
  onConfirm: () => void;
  applying?: boolean;
  onResetAll: () => void;
  /** Profile target roles — excluded from job-function chips when they bleed into customJobFunctions. */
  excludeTargetRoleBleed?: string[];
}) {
  const isMobile = useIsMobile();
  const navHeight = isMobile ? TOP_NAV_HEIGHT_MOBILE : TOP_NAV_HEIGHT;
  const drawerInset = isMobile ? 0 : 8;
  const drawerTop = navHeight + drawerInset;

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

  const chips = useMemo(
    () =>
      buildOpportunitiesFilterChips(form, {
        excludeTargetRoleBleed,
      }),
    [form, excludeTargetRoleBleed],
  );

  const handleRemoveChip = useCallback(
    (chipId: string) => {
      const chip = chips.find((c) => c.id === chipId);
      if (!chip) return;
      setForm((prev) => removeOpportunitiesFilterChip(prev, chip));
    },
    [chips, setForm],
  );

  const handleClearSection = useCallback(
    (section: AllFiltersSectionId) => {
      setForm((prev) => clearOpportunitiesFilterSection(section, prev));
    },
    [setForm],
  );

  if (!open) return null;

  const drawerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: drawerTop,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
      }
    : {
        position: "fixed",
        top: drawerTop,
        right: drawerInset,
        bottom: drawerInset,
        width: DRAWER_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        borderRadius: isMobile ? undefined : 12,
        boxShadow: "-8px 0 40px rgba(0,0,0,0.14)",
      };

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          top: navHeight,
          left: 0,
          right: 0,
          bottom: 0,
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
          overflow: "hidden",
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
                borderRadius: "var(--scout-radius)",
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
            background: surface.card,
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
            {opportunitiesDrawerTitle(form)}
          </p>
          <button
            type="button"
            className={BRUDDLE_BTN_CLASS}
            onClick={onConfirm}
            disabled={applying}
            style={{
              padding: "9px 22px",
              border: "var(--scout-border)",
              borderRadius: "var(--scout-radius)",
              ...scoutPrimaryCtaStyle,
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
              background: surface.card,
            }}
          >
            {chips.map((chip) => (
              <span
                key={chip.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px 5px 12px",
                  borderRadius: "var(--scout-radius)",
                  background: surface.inset,
                  border: border.line,
                  fontFamily: fontSans,
                  fontSize: T.label,
                  color: color.ink,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label}`}
                  onClick={() => handleRemoveChip(chip.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    padding: 0,
                    border: "none",
                    borderRadius: "var(--scout-radius)",
                    background: "rgba(17,17,17,0.08)",
                    color: color.muted,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
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
              <div style={{ padding: "0 12px 12px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={onResetAll}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: border.line,
                    borderRadius: 8,
                    background: surface.card,
                    fontFamily: fontSans,
                    fontSize: T.label,
                    fontWeight: 600,
                    color: color.muted,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset all filters
                </button>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "rgba(45, 107, 74, 0.1)",
                    border: "1px solid rgba(45, 107, 74, 0.22)",
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
              </div>
            </aside>
          )}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {isMobile && (
              <>
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
                          borderRadius: "var(--scout-radius)",
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
                <div style={{ padding: "8px 14px 0", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={onResetAll}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontFamily: fontSans,
                      fontSize: T.label,
                      fontWeight: 600,
                      color: color.muted,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Reset all filters
                  </button>
                </div>
              </>
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
                onClearSection={handleClearSection}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Re-export for tests / callers that reset the form to empty defaults. */
export { resetOpportunitiesFilterForm };
