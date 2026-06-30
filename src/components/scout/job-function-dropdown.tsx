"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GroupedJobFunctions } from "@/lib/job-function-groups";
import { fontSans, color, border, type as T } from "@/lib/typography";
import { pipelineInputStyle } from "./pipeline-filters-ui";

const MINT_TAG: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(45, 107, 74, 0.35)",
  background: "rgba(45, 107, 74, 0.14)",
  color: color.forest,
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
};

function displayCategoryLabel(cat: string): string {
  return cat.replace(/ Jobs$/i, "");
}

type Props = {
  selected: string[];
  customSelected: string[];
  onChange: (taxonomy: string[], custom: string[]) => void;
  suggested?: string[];
  maxSelections?: number;
};

export function JobFunctionDropdown({
  selected,
  customSelected,
  onChange,
  suggested = [],
  maxSelections = 12,
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

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = flatCategories.length ? flatCategories : suggested;
    const filtered = q
      ? pool.filter((cat) => cat.toLowerCase().includes(q) || displayCategoryLabel(cat).toLowerCase().includes(q))
      : pool;
    return filtered
      .filter((cat) => !allSelectedLower.has(cat.toLowerCase()))
      .slice(0, 8);
  }, [query, flatCategories, suggested, allSelectedLower]);

  const groupLabelFor = (cat: string): string | null => {
    for (const g of groups) {
      if (g.categories.some((c) => c.toLowerCase() === cat.toLowerCase())) return g.label;
    }
    return null;
  };

  const showCreate =
    query.trim().length > 0 &&
    !allSelectedLower.has(query.trim().toLowerCase()) &&
    !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  return (
    <div style={{ width: 320, maxWidth: "90vw" }}>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 8px" }}>
        <span style={{ color: "#C4574A" }}>*</span> Job Function
      </p>

      {(selected.length > 0 || customSelected.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {selected.map((cat) => (
            <span key={`t-${cat}`} style={MINT_TAG}>
              {displayCategoryLabel(cat)}
              <button
                type="button"
                aria-label={`Remove ${cat}`}
                onClick={() => removeItem(cat, false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))}
          {customSelected.map((cat) => (
            <span key={`c-${cat}`} style={MINT_TAG}>
              {cat}
              <button
                type="button"
                aria-label={`Remove ${cat}`}
                onClick={() => removeItem(cat, true)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.45 }} />
        <input
          style={{ ...pipelineInputStyle, paddingLeft: 32, margin: 0 }}
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

      <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: showCreate ? 8 : 0 }}>
        {loading && (
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0" }}>
            Loading suggestions…
          </p>
        )}
        {!loading &&
          suggestions.map((cat) => {
            const groupLabel = groupLabelFor(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleTaxonomy(cat)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 6px",
                  border: "none",
                  borderBottom: border.line,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>
                  {displayCategoryLabel(cat)}
                </span>
                {groupLabel && (
                  <span style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginTop: 2 }}>
                    {groupLabel}
                  </span>
                )}
              </button>
            );
          })}
        {!loading && !suggestions.length && query.trim() && !showCreate && (
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 0" }}>
            No matches — create a custom function below.
          </p>
        )}
      </div>

      {showCreate && (
        <button
          type="button"
          onClick={createCustom}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "none",
            borderRadius: 8,
            background: "rgba(255, 180, 120, 0.35)",
            color: color.ink,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          + Create a custom job function with &ldquo;{query.trim()}&rdquo;
        </button>
      )}
    </div>
  );
}

export function jobFunctionPillItems(form: { jobCategories: string; customJobFunctions?: string[] }): string[] {
  const taxonomy = form.jobCategories.split(/[,;|]/).map((s) => s.trim()).filter(Boolean).map(displayCategoryLabel);
  const custom = (form.customJobFunctions ?? []).map((s) => s.trim()).filter(Boolean);
  return [...taxonomy, ...custom];
}
