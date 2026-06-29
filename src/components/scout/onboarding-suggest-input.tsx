"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeRoleSuggestions,
  normalizeCustomRoleTitle,
  TARGET_ROLE_SUGGESTIONS,
} from "@/lib/target-roles";
import {
  buildSuggestDropdownRows,
  type SuggestDropdownRow,
} from "@/lib/suggest-input";

const ONBOARDING_TEXT = "#2A2218";
const ONBOARDING_TEXT_SECONDARY = "rgba(42,34,24,0.55)";
const ONBOARDING_LABEL_COLOR = "rgba(42,34,24,0.65)";
const ONBOARDING_FIELD_BG = "#FAF7F2";
const ONBOARDING_FIELD_BORDER = "1.5px solid rgba(26,58,47,0.14)";

const SUGGEST_DROPDOWN_STYLE: React.CSSProperties = {
  position: "absolute",
  zIndex: 20,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  margin: 0,
  padding: 6,
  listStyle: "none",
  background: "#FFFFFF",
  border: "1px solid rgba(26,58,47,0.16)",
  borderRadius: "var(--scout-radius)",
  boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
  maxHeight: 240,
  overflowY: "auto",
};

function SuggestDropdownList({
  rows,
  highlight,
  onHighlight,
  onPick,
  listboxId,
}: {
  rows: SuggestDropdownRow[];
  highlight: number;
  onHighlight: (index: number) => void;
  onPick: (row: SuggestDropdownRow) => void;
  listboxId: string;
}) {
  if (!rows.length) return null;

  return (
    <ul id={listboxId} role="listbox" style={SUGGEST_DROPDOWN_STYLE}>
      {rows.map((row, index) => (
        <li key={row.kind === "create" ? `create-${row.value}` : row.value} role="option" aria-selected={index === highlight}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(row)}
            onMouseEnter={() => onHighlight(index)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              border: "none",
              borderRadius: "var(--scout-radius)",
              background: index === highlight ? "rgba(26,58,47,0.08)" : "transparent",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: row.kind === "create" ? 600 : 500,
              color: row.kind === "create" ? "#1A3A2F" : ONBOARDING_TEXT,
              cursor: "pointer",
            }}
          >
            {row.kind === "create" ? row.label : row.value}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function OnboardingCategoryFilterInput({
  query,
  onQueryChange,
  selectedCategories,
  categoryPool,
  onAdd,
  placeholder = "Search or add category…",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedCategories: string[];
  categoryPool: string[];
  onAdd: (category: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(true);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(
    () =>
      categoryPool.filter(
        (cat) =>
          !selectedCategories.some((selected) => selected.toLowerCase() === cat.toLowerCase()) &&
          (!query.trim() || cat.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [categoryPool, selectedCategories, query],
  );

  const dropdownRows = useMemo(
    () => buildSuggestDropdownRows(query, filteredCategories.slice(0, 8)),
    [query, filteredCategories],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, dropdownRows.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const tryAdd = (raw: string) => {
    const normalized = normalizeCustomRoleTitle(raw);
    if (!normalized) return false;
    if (selectedCategories.some((selected) => selected.toLowerCase() === normalized.toLowerCase())) {
      return false;
    }
    onAdd(normalized);
    onQueryChange("");
    setOpen(false);
    return true;
  };

  const pickRow = (row: SuggestDropdownRow) => {
    tryAdd(row.value);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        autoFocus
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && dropdownRows.length > 0}
        aria-controls="onboarding-category-listbox"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((index) => Math.min(index + 1, Math.max(dropdownRows.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && dropdownRows[highlight]) pickRow(dropdownRows[highlight]);
            else tryAdd(query);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        style={{
          width: "100%",
          padding: "12px 14px",
          border: ONBOARDING_FIELD_BORDER,
          borderRadius: "var(--scout-radius)",
          background: ONBOARDING_FIELD_BG,
          fontFamily: "var(--font-ui)",
          fontSize: 15,
          boxSizing: "border-box",
        }}
      />
      {open && (
        <SuggestDropdownList
          rows={dropdownRows}
          highlight={highlight}
          onHighlight={setHighlight}
          onPick={pickRow}
          listboxId="onboarding-category-listbox"
        />
      )}
    </div>
  );
}

function TargetRoleChip({
  title,
  onRemove,
}: {
  title: string;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "rgba(26,58,47,0.12)",
        border: "1.5px solid #1A3A2F",
        borderRadius: "var(--scout-radius)",
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: 600,
        color: "#1A3A2F",
      }}
    >
      {title}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            lineHeight: 1,
            color: "#1A3A2F",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function TargetRoleAutocomplete({
  selectedTitles,
  suggestedTitles,
  suggestionLabel = "Suggested from your resume",
  onAddTitle,
  onRemoveTitle,
  onDropdownOpenChange,
}: {
  selectedTitles: string[];
  suggestedTitles: string[];
  suggestionLabel?: string;
  onAddTitle: (title: string) => void;
  onRemoveTitle: (title: string) => void;
  onDropdownOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readbackSuggestions = suggestedTitles.filter((t) => !selectedTitles.includes(t));

  const suggestionOptions = useMemo(() => {
    return mergeRoleSuggestions(query, readbackSuggestions, 10).filter(
      (t) => !selectedTitles.includes(t),
    );
  }, [query, readbackSuggestions, selectedTitles]);

  const dropdownRows = useMemo(
    () => buildSuggestDropdownRows(query, suggestionOptions),
    [query, suggestionOptions],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, dropdownRows.length]);

  useEffect(() => {
    onDropdownOpenChange?.(open && dropdownRows.length > 0);
  }, [open, dropdownRows.length, onDropdownOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const tryAdd = (raw: string) => {
    const normalized = normalizeCustomRoleTitle(raw);
    if (!normalized || selectedTitles.includes(normalized)) return false;
    if (selectedTitles.length >= 10) return false;
    onAddTitle(normalized);
    setQuery("");
    setOpen(false);
    return true;
  };

  const pickRow = (row: SuggestDropdownRow) => {
    tryAdd(row.value);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef}>
      {selectedTitles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {selectedTitles.map((title) => (
            <TargetRoleChip key={title} title={title} onRemove={() => onRemoveTitle(title)} />
          ))}
        </div>
      )}

      {readbackSuggestions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              color: ONBOARDING_TEXT_SECONDARY,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              marginBottom: 8,
              marginTop: 0,
            }}
          >
            {suggestionLabel}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {readbackSuggestions.slice(0, 5).map((title) => (
              <button
                key={title}
                type="button"
                className="onboarding-chip"
                onClick={() => tryAdd(title)}
                style={{
                  padding: "8px 14px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: ONBOARDING_TEXT,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <label
          htmlFor="target-role-input"
          style={{
            display: "block",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_LABEL_COLOR,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Target roles · {selectedTitles.length} selected
        </label>
        <input
          id="target-role-input"
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Start typing a role title…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && dropdownRows.length > 0}
          aria-controls="target-role-listbox"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((i) => Math.min(i + 1, Math.max(dropdownRows.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && dropdownRows[highlight]) pickRow(dropdownRows[highlight]);
              else tryAdd(query);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "12px 14px",
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: "var(--scout-radius)",
            background: ONBOARDING_FIELD_BG,
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            fontWeight: 500,
            color: ONBOARDING_TEXT,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {open && (
          <SuggestDropdownList
            rows={dropdownRows}
            highlight={highlight}
            onHighlight={setHighlight}
            onPick={pickRow}
            listboxId="target-role-listbox"
          />
        )}
      </div>

      {!query && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          {TARGET_ROLE_SUGGESTIONS.length}+ common titles — start typing, or pick a suggestion below.
        </p>
      )}
    </div>
  );
}
