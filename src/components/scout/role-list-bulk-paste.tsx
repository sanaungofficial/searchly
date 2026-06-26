"use client";

import React, { useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { fontSans, color, border, type as T } from "@/lib/typography";
import { mergeRoleTitleLists, parseRoleTitleList } from "@/lib/parse-role-title-list";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";

type BulkListKind =
  | "target"
  | "prioritized"
  | "deprioritized"
  | "prioritized-categories"
  | "deprioritized-categories";

const LIST_OPTIONS: { value: BulkListKind; label: string }[] = [
  { value: "target", label: "Target roles" },
  { value: "prioritized", label: "Prioritized roles" },
  { value: "deprioritized", label: "Deprioritized roles" },
  { value: "prioritized-categories", label: "Prioritized categories" },
  { value: "deprioritized-categories", label: "Deprioritized categories" },
];

type RoleListBulkPasteProps = {
  dreamList: string[];
  onTargetChange: (next: string[]) => void;
  prioritizedList: string[];
  onPrioritizedChange: (next: string[]) => void;
  deprioritizedList: string[];
  onDeprioritizedChange: (next: string[]) => void;
  prioritizedCategories: string[];
  onPrioritizedCategoriesChange: (next: string[]) => void;
  deprioritizedCategories: string[];
  onDeprioritizedCategoriesChange: (next: string[]) => void;
  onInitRoleSettings?: (role: string) => void;
};

export function RoleListBulkPaste({
  dreamList,
  onTargetChange,
  prioritizedList,
  onPrioritizedChange,
  deprioritizedList,
  onDeprioritizedChange,
  prioritizedCategories,
  onPrioritizedCategoriesChange,
  deprioritizedCategories,
  onDeprioritizedCategoriesChange,
  onInitRoleSettings,
}: RoleListBulkPasteProps) {
  const { showAdminUi, isImpersonating } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [listKind, setListKind] = useState<BulkListKind>("deprioritized");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [status, setStatus] = useState<string | null>(null);

  const parsed = useMemo(() => parseRoleTitleList(text), [text]);

  if (!showAdminUi && !isImpersonating) return null;

  const currentList = (): string[] => {
    switch (listKind) {
      case "target":
        return dreamList;
      case "prioritized":
        return prioritizedList;
      case "deprioritized":
        return deprioritizedList;
      case "prioritized-categories":
        return prioritizedCategories;
      case "deprioritized-categories":
        return deprioritizedCategories;
    }
  };

  const applyList = (next: string[]) => {
    switch (listKind) {
      case "target":
        onTargetChange(next);
        break;
      case "prioritized":
        onPrioritizedChange(next);
        break;
      case "deprioritized":
        onDeprioritizedChange(next);
        break;
      case "prioritized-categories":
        onPrioritizedCategoriesChange(next);
        break;
      case "deprioritized-categories":
        onDeprioritizedCategoriesChange(next);
        break;
    }
  };

  const handleApply = () => {
    if (!parsed.length) {
      setStatus("Nothing to add — paste one role per line.");
      return;
    }

    const existing = currentList();
    let next: string[];
    let added: string[];

    if (mode === "replace") {
      next = parsed;
      added = parsed.filter(
        (title) => !existing.some((r) => r.toLowerCase() === title.toLowerCase()),
      );
    } else {
      const result = mergeRoleTitleLists(existing, parsed);
      next = result.merged;
      added = result.added;
    }

    applyList(next);

    if (listKind === "target" && onInitRoleSettings) {
      for (const role of added) onInitRoleSettings(role);
    }

    const skipped = parsed.length - added.length;
    const parts = [`Added ${added.length} ${added.length === 1 ? "item" : "items"}`];
    if (mode === "merge" && skipped > 0) parts.push(`${skipped} already on the list`);
    if (mode === "replace") parts.push("replaced the full list");
    setStatus(parts.join(" · "));
    setText("");
  };

  return (
    <ScoutBox flat padding={16} style={{ marginBottom: 28, background: "rgba(26,58,47,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <ScoutLabel>Bulk paste (admin)</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
            Paste many roles at once — one per line works best. Commas inside titles like &ldquo;Director, Product Management&rdquo; stay intact.
          </p>
        </div>
        <ScoutSecondaryBtn onClick={() => setOpen((v) => !v)} style={{ flexShrink: 0 }}>
          {open ? "Hide" : "Open parser"}
        </ScoutSecondaryBtn>
      </div>

      {open && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              Add to
              <select
                value={listKind}
                onChange={(e) => {
                  setListKind(e.target.value as BulkListKind);
                  setStatus(null);
                }}
                style={{
                  display: "block",
                  marginTop: 4,
                  minWidth: 220,
                  padding: "8px 10px",
                  border: border.lineStrong,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  background: "#fff",
                }}
              >
                {LIST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
              <legend style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                Mode
              </legend>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontFamily: fontSans, fontSize: T.bodySm, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="bulk-role-mode"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                  />
                  Merge with existing
                </label>
                <label style={{ fontFamily: fontSans, fontSize: T.bodySm, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="bulk-role-mode"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  Replace list
                </label>
              </div>
            </fieldset>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setStatus(null);
            }}
            rows={8}
            placeholder={`Account Executive\nProduct Manager\nSales Development Representative\n\nOr semicolon-separated: AE; PM; SDR`}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "var(--scout-radius)",
              border: border.lineStrong,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              lineHeight: 1.55,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />

          {parsed.length > 0 && (
            <div>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
                Preview ({parsed.length} {parsed.length === 1 ? "item" : "items"})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {parsed.slice(0, 24).map((title) => (
                  <span
                    key={title}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--scout-radius)",
                      background: "#fff",
                      border: border.line,
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      color: color.ink,
                    }}
                  >
                    {title}
                  </span>
                ))}
                {parsed.length > 24 && (
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, alignSelf: "center" }}>
                    +{parsed.length - 24} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn onClick={handleApply} disabled={!parsed.length}>
              Apply to {LIST_OPTIONS.find((o) => o.value === listKind)?.label.toLowerCase()}
            </ScoutPrimaryBtn>
            {status && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, margin: 0 }}>{status}</p>
            )}
          </div>
        </div>
      )}
    </ScoutBox>
  );
}
