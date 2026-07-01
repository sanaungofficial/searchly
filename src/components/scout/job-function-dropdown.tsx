"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GroupedJobFunctions } from "@/lib/job-function-groups";
import {
  displayJobFunctionLabel,
  groupLabelForJobFunction,
  jobFunctionBreadcrumb,
} from "@/lib/job-function-groups";
import { fontSans, color, border, surface, type as T } from "@/lib/typography";
import { pipelineInputStyle } from "./pipeline-filters-ui";

const MINT_CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: "var(--scout-radius)",
  border: "1px solid rgba(76, 175, 80, 0.35)",
  background: "rgba(76, 175, 80, 0.16)",
  color: color.ink,
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
};

type Props = {
  selected: string[];
  customSelected: string[];
  onChange: (taxonomy: string[], custom: string[]) => void;
  maxSelections?: number;
  /** Show `* Job Function` label (default true). */
  showLabel?: boolean;
  /** Stretch to container width (modals / drawer). */
  fullWidth?: boolean;
};

export function JobFunctionDropdown({
  selected,
  customSelected,
  onChange,
  maxSelections = 12,
  showLabel = true,
  fullWidth = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupedJobFunctions[]>([]);
  const [flatCategories, setFlatCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/jobs/job-functions")
      .then((res) => (res.ok ? res.json() : { groups: [], categories: [] }))
      .then((data: { groups?: GroupedJobFunctions[]; categories?: string[] }) => {
        setGroups(data.groups ?? []);
        setFlatCategories(data.categories ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allSelectedLower = useMemo(
    () => new Set([...selected, ...customSelected].map((s) => s.toLowerCase())),
    [selected, customSelected],
  );

  const toggleTaxonomy = useCallback(
    (cat: string) => {
      const normalized = cat.trim();
      if (!normalized) return;
      if (allSelectedLower.has(normalized.toLowerCase())) {
        onChange(
          selected.filter((s) => s.toLowerCase() !== normalized.toLowerCase()),
          customSelected.filter((s) => s.toLowerCase() !== normalized.toLowerCase()),
        );
        return;
      }
      if (selected.length + customSelected.length >= maxSelections) return;
      onChange([...selected, normalized], customSelected);
      setQuery("");
    },
    [allSelectedLower, selected, customSelected, onChange, maxSelections],
  );

  const removeItem = useCallback(
    (item: string, isCustom: boolean) => {
      if (isCustom) {
        onChange(
          selected,
          customSelected.filter((s) => s.toLowerCase() !== item.toLowerCase()),
        );
      } else {
        onChange(
          selected.filter((s) => s.toLowerCase() !== item.toLowerCase()),
          customSelected,
        );
      }
    },
    [selected, customSelected, onChange],
  );

  const createCustom = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || allSelectedLower.has(trimmed.toLowerCase())) return;
    if (selected.length + customSelected.length >= maxSelections) return;
    onChange(selected, [...customSelected, trimmed]);
    setQuery("");
  }, [query, allSelectedLower, selected, customSelected, onChange, maxSelections]);

  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();

  const filtered = useMemo(() => {
    if (!queryLower) return [];
    return flatCategories
      .filter(
        (cat) =>
          cat.toLowerCase().includes(queryLower) ||
          displayJobFunctionLabel(cat).toLowerCase().includes(queryLower),
      )
      .filter((cat) => !allSelectedLower.has(cat.toLowerCase()))
      .slice(0, 24);
  }, [queryLower, flatCategories, allSelectedLower]);

  const exactTaxonomyMatch = useMemo(
    () =>
      queryLower
        ? flatCategories.some(
            (cat) =>
              cat.toLowerCase() === queryLower ||
              displayJobFunctionLabel(cat).toLowerCase() === queryLower,
          )
        : false,
    [queryLower, flatCategories],
  );

  const showCreate =
    trimmedQuery.length > 0 &&
    !allSelectedLower.has(queryLower) &&
    !exactTaxonomyMatch;

  const showResults = trimmedQuery.length > 0;

  return (
    <div style={{ width: fullWidth ? "100%" : 320, maxWidth: fullWidth ? "100%" : "90vw" }}>
      {showLabel && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink, margin: "0 0 8px" }}>
          <span style={{ color: "#C4574A" }}>*</span> Job Function
        </p>
      )}

      {(selected.length > 0 || customSelected.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {selected.map((cat) => (
            <span key={`t-${cat}`} style={MINT_CHIP}>
              {displayJobFunctionLabel(cat)}
              <button
                type="button"
                aria-label={`Remove ${cat}`}
                onClick={() => removeItem(cat, false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit", fontSize: 16 }}
              >
                ×
              </button>
            </span>
          ))}
          {customSelected.map((cat) => (
            <span key={`c-${cat}`} style={MINT_CHIP}>
              {cat}
              <button
                type="button"
                aria-label={`Remove ${cat}`}
                onClick={() => removeItem(cat, true)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit", fontSize: 16 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: showResults || showCreate ? 0 : 0 }}>
        <Search
          size={14}
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
        />
        <input
          style={{
            ...pipelineInputStyle,
            paddingLeft: 32,
            margin: 0,
            background: surface.inset,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search job functions"
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCreate) {
              e.preventDefault();
              createCustom();
            }
          }}
        />
      </div>

      {showResults && (
        <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
          {loading && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 6px" }}>
              Loading job functions…
            </p>
          )}
          {!loading &&
            filtered.map((cat) => {
              const groupLabel = groupLabelForJobFunction(cat, groups);
              const breadcrumb = groupLabel ? jobFunctionBreadcrumb(cat, groupLabel) : null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleTaxonomy(cat)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 6px",
                    border: "none",
                    borderBottom: border.line,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink }}>
                    {displayJobFunctionLabel(cat)}
                  </span>
                  {breadcrumb && (
                    <span style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginTop: 3 }}>
                      {breadcrumb}
                    </span>
                  )}
                </button>
              );
            })}
          {!loading && !filtered.length && !showCreate && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 6px" }}>
              No matches — create a custom function below.
            </p>
          )}
        </div>
      )}

      {showCreate && (
        <button
          type="button"
          onClick={createCustom}
          style={{
            width: "100%",
            padding: "10px 12px",
            marginTop: showResults && filtered.length ? 0 : 4,
            border: "none",
            borderRadius: 8,
            background: "rgba(255, 167, 120, 0.38)",
            color: color.ink,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          + Create a custom job function with &ldquo;{trimmedQuery}&rdquo;
        </button>
      )}
    </div>
  );
}

export function jobFunctionPillItems(form: { jobCategories: string; customJobFunctions?: string[] }): string[] {
  const taxonomy = form.jobCategories
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(displayJobFunctionLabel);
  const custom = (form.customJobFunctions ?? []).map((s) => s.trim()).filter(Boolean);
  return [...taxonomy, ...custom];
}
