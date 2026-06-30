"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { describeActiveFilters } from "@/lib/recommended-filter-utils";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ALL_FILTER_SECTIONS,
  AllFiltersSectionContent,
  type AllFiltersSectionId,
  type RecommendedFilterForm,
} from "./pipeline-recommended-filters";
import { jobFunctionPillItems } from "./job-function-dropdown";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";

const MODAL_Z = 240;

function modalSummaryTitle(form: RecommendedFilterForm): string {
  const parts: string[] = [];
  const jobFns = jobFunctionPillItems(form);
  if (jobFns.length) parts.push(jobFns.slice(0, 2).join(", "));
  if (form.locationCountry.trim()) {
    parts.push(form.locationAllInCountry ? "US" : form.locationCountry.trim());
  }
  if (!parts.length) return "All Filters";
  const extra = jobFns.length > 2 ? ` + ${jobFns.length - 2} roles` : "";
  return `${parts[0]}${extra}`;
}

function activeChipLabels(form: RecommendedFilterForm, filters: VectorSearchFilters): string[] {
  return describeActiveFilters(filters).map((label) => {
    const colon = label.indexOf(":");
    return colon >= 0 ? label.slice(colon + 1).trim() : label;
  });
}

export function OpportunitiesAllFiltersModal({
  open,
  onClose,
  form,
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
  setForm: React.Dispatch<React.SetStateAction<RecommendedFilterForm>>;
  toggleSet: (set: Set<string>, value: string) => Set<string>;
  trackedCompanyNames: string[];
  categorySuggestions?: string[];
  onConfirm: () => void;
  applying?: boolean;
  appliedFilters: VectorSearchFilters;
}) {
  const isMobile = useIsMobile();
  const [section, setSection] = useState<AllFiltersSectionId>("basic");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setSection("basic");
  }, [open]);

  const chips = useMemo(() => activeChipLabels(form, appliedFilters), [form, appliedFilters]);
  const visibleChips = chips.slice(0, 6);
  const overflowCount = chips.length - visibleChips.length;

  if (!open) return null;

  const sheetStyle: React.CSSProperties = isMobile
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
        inset: 0,
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
          zIndex: MODAL_Z,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
        style={{
          ...sheetStyle,
          zIndex: MODAL_Z + 1,
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
            justifyContent: "space-between",
            gap: 12,
            padding: isMobile ? "12px 14px" : "14px 20px",
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
              gap: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: color.ink,
              padding: 0,
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 700,
              color: color.ink,
              margin: 0,
              flex: 1,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {modalSummaryTitle(form)}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying}
            style={{
              padding: "8px 18px",
              border: border.lineStrong,
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
                  padding: "5px 10px",
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
                  padding: "5px 10px",
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
                width: 260,
                flexShrink: 0,
                borderRight: border.line,
                overflowY: "auto",
                background: surface.inset,
                padding: "12px 0",
              }}
            >
              {ALL_FILTER_SECTIONS.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      border: "none",
                      borderLeft: active ? `3px solid ${color.forest}` : "3px solid transparent",
                      background: active ? surface.card : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        fontWeight: active ? 700 : 600,
                        color: active ? color.forest : color.ink,
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
              <div
                style={{
                  margin: "16px 12px 0",
                  padding: "12px",
                  borderRadius: 8,
                  background: "rgba(45, 107, 74, 0.08)",
                  border: "1px solid rgba(45, 107, 74, 0.2)",
                }}
              >
                <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0, lineHeight: 1.45 }}>
                  Use Company Insights to search a specific company or exclude staffing agencies.
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
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
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
            <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px 14px 24px" : "20px 24px 32px" }}>
              <AllFiltersSectionContent
                section={section}
                form={form}
                setForm={setForm}
                toggleSet={toggleSet}
                trackedCompanyNames={trackedCompanyNames}
                categorySuggestions={categorySuggestions}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: isMobile ? 10 : 14,
            right: isMobile ? 10 : 14,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            color: color.muted,
            display: isMobile ? "flex" : "none",
          }}
        >
          <X size={20} />
        </button>
      </div>
    </>
  );
}
