"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import type { GroupedJobFunctions } from "@/lib/job-function-groups";

type JobFunctionPickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  suggested?: string[];
  /** Onboarding vs profile styling */
  variant?: "onboarding" | "profile";
  maxSelections?: number;
};

export function JobFunctionPicker({
  selected,
  onChange,
  suggested = [],
  variant = "profile",
  maxSelections = 12,
}: JobFunctionPickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupedJobFunctions[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || groups.length) return;
    setLoading(true);
    void fetch("/api/jobs/job-functions")
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data: { groups?: GroupedJobFunctions[] }) => {
        const loaded = data.groups ?? [];
        setGroups(loaded);
        if (loaded.length && !activeGroupId) setActiveGroupId(loaded[0]!.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, groups.length, activeGroupId]);

  const selectedLower = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);

  const toggleCategory = useCallback(
    (cat: string) => {
      const normalized = cat.trim();
      if (!normalized) return;
      if (selectedLower.has(normalized.toLowerCase())) {
        onChange(selected.filter((s) => s.toLowerCase() !== normalized.toLowerCase()));
        return;
      }
      if (selected.length >= maxSelections) return;
      onChange([...selected, normalized]);
    },
    [selected, selectedLower, onChange, maxSelections],
  );

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  const suggestedVisible = suggested.filter((s) => !selectedLower.has(s.toLowerCase())).slice(0, 6);

  const chipStyle: React.CSSProperties =
    variant === "onboarding"
      ? {
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(26,58,47,0.08)",
          border: "1.5px solid rgba(26,58,47,0.25)",
          borderRadius: "var(--scout-radius)",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          fontWeight: 600,
          color: "#1A3A2F",
        }
      : {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          border: border.line,
          borderRadius: "var(--scout-radius)",
          fontFamily: fontSans,
          fontSize: T.label,
          color: color.forest,
          background: "rgba(45, 107, 74, 0.1)",
        };

  const pillBtn = (cat: string, active: boolean) => (
    <button
      key={cat}
      type="button"
      onClick={() => toggleCategory(cat)}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: active ? "1.5px solid rgba(45, 107, 74, 0.5)" : border.line,
        background: active ? "rgba(45, 107, 74, 0.18)" : surface.card,
        color: active ? color.forest : color.ink,
        fontFamily: fontSans,
        fontSize: T.caption,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {cat.replace(/ Jobs$/i, "")}
    </button>
  );

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {selected.map((cat) => (
            <span key={cat} style={chipStyle}>
              {cat.replace(/ Jobs$/i, "")}
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-label={`Remove ${cat}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestedVisible.length > 0 && !open && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            Suggested for you
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestedVisible.map((cat) => pillBtn(cat, false))}
          </div>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: variant === "onboarding" ? "8px 14px" : "8px 14px",
            background: "transparent",
            color: color.forest,
            border: variant === "onboarding" ? "1.5px solid rgba(26,58,47,0.14)" : "1px solid rgba(26,58,47,0.15)",
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Add job function
        </button>
      ) : (
        <div
          style={{
            border: border.lineStrong,
            borderRadius: "var(--scout-radius)",
            overflow: "hidden",
            background: surface.card,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "160px 1fr",
              minHeight: isMobile ? "auto" : 280,
              maxHeight: isMobile ? "none" : 360,
            }}
          >
            {!isMobile && (
              <div
                style={{
                  borderRight: border.line,
                  overflowY: "auto",
                  background: surface.inset,
                }}
              >
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveGroupId(g.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: border.line,
                      background: activeGroup?.id === g.id ? surface.card : "transparent",
                      color: activeGroup?.id === g.id ? color.forest : color.ink,
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: activeGroup?.id === g.id ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: 14, overflowY: "auto" }}>
              {isMobile && (
                <select
                  value={activeGroupId ?? ""}
                  onChange={(e) => setActiveGroupId(e.target.value)}
                  style={{
                    width: "100%",
                    marginBottom: 12,
                    padding: "8px 10px",
                    border: border.line,
                    borderRadius: "var(--scout-radius)",
                    fontFamily: fontSans,
                    fontSize: T.caption,
                  }}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}

              {loading && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                  Loading job functions…
                </p>
              )}

              {!loading && activeGroup && (
                <>
                  <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "0 0 10px", fontWeight: 600 }}>
                    {activeGroup.label}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeGroup.categories.map((cat) =>
                      pillBtn(cat, selectedLower.has(cat.toLowerCase())),
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderTop: border.line,
              background: surface.inset,
            }}
          >
            <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>
              {selected.length}/{maxSelections} selected
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 14px",
                border: border.lineStrong,
                borderRadius: 999,
                background: color.forest,
                color: color.gold,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
